import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import proxyPlugin from 'puppeteer-extra-plugin-proxy';
import chromium from '@sparticuz/chromium';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import moment from 'moment';
import { createHash } from 'crypto';
import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load .env
config();

// Configure S3 Client
const client = new S3Client({});

// Config locale
moment.locale('es');
const formatString = 'dddd DD MMMM, YYYY HH:mm';

// For createing short IDs
function hash(url) {
  const hash = createHash('md5').update(url).digest('hex');
  return hash.slice(0, 32);
}

// Creates the browser for puppeteer
async function initializeBrowser() {
  try {
    puppeteerExtra.use(stealthPlugin);
    puppeteerExtra.use(AdblockerPlugin({ blockTrackers: true }));

    //puppeteerExtra.use(proxyPlugin({
    //  address: '190.153.237.2',
    //  port: 37453
    //}));

    // Local dev test
    const browser = await puppeteerExtra.launch({
      headless: 'new',
      devtools: true,
      //executablePath: "/home/stare/Downloads/chromedriver" //113.0.5672.63
      //executablePath: "/home/stare/.local/share/flatpak/app/com.google.Chrome/current/active/export/bin/com.google.Chrome"
    });

    //args: [...chromium.args, '--proxy-server=http://190.153.237.2:37453'],

    // For aws
    /*const browser = await puppeteerExtra.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });*/
    return browser;

  } catch (error) {
    console.log("Error with browser", error);
  }
}

function getLowestDate(dates) {
  var lowest = dates[0].date === '' ? new Date() : dates[0].date;
  for (var i = 1; i < dates.length; i++) {
    if (dates[i].date !== '' && dates[i].date < lowest) {
      lowest = dates[i].date;
    }
  }
  return lowest;
}

//** SCRAPPER FUNCTIONS **//

async function scrapeBioBioArticles(browser, targets) {
  const result = [];
  var now_date = new Date();

  for (const target of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.goto(target.url, { waitUntil: 'load', timeout: 0 });

    var last_date = await getLastArticleDate(target.entity, target.category);
    const daysDiff = moment.duration(moment(now_date).diff(moment(last_date))).asDays();
    if (daysDiff > 1) last_date = new Date().setHours(-24);

    var upper_date = new Date();

    while (upper_date > last_date) {

      // Scrap
      console.log(`Processing... ${target.url}`);
      console.log(`From ${upper_date} to ${last_date}`);

      await page.evaluate(() => {
        const scrollHeight = document.body.scrollHeight;
        for (let i = 0; i < scrollHeight; i += 100) {
          window.scrollBy(0, 100);
        }
      });

      // Load more
      await page.waitForSelector('body > main > div > section > div.section-body > div.results-container > div > div > div.fetch-btn-container > button');
      await page.click('body > main > div > section > div.section-body > div.results-container > div > div > div.fetch-btn-container > button');

      // Take screenshot and get buffer
      const screenshotBuffer = await page.screenshot();

      // Upload to S3
      const fileName = `sc_biobiochile-${Date.now()}.png`;
      await uploadToS3(screenshotBuffer, fileName);

      console.log(`Uploaded to S3 ${fileName}`);

      console.log("Begin scrape");

      // Begin scrape

      const articles = await page.$$('article');

      //body > main > div > section > div.section-body > div.highlight > article
      //body > main > div > section > div.section-body > div.results-container > div > article:nth-child(1)

      const data = await Promise.all(articles.map(async (article) => {
        return article.evaluate(articleEl => {
          const aTitle = articleEl.querySelector('a > h2.article-title')?.textContent;

          // Skip the article if it doesn't have a title
          if (!aTitle) {
            console.log(articleEl.outerHTML);
            return null;
          }

          return {
            title: aTitle.trim(),
            link: articleEl.querySelector('div > a')?.href || '',
            /** Warning: Date is not available when scrapping the header article. **/
            date: articleEl.querySelector('div > div > div.article-date-hour')?.textContent || '',
            image: articleEl.querySelector('a > div.article-image')?.style.backgroundImage || '',
            raw_content: articleEl.outerHTML || ''
          };
        });
      }));

      const filteredData = data.filter(article => article !== null);

      const formattedData = filteredData.map(article => {
        let parsedUrl = article.image;

        const urlMatch = article.image.match(/url\(["']?(.*?)["']?\)/);
        if (urlMatch && urlMatch.length > 1) {
          parsedUrl = urlMatch[1];
        }

        return {
          ...article,
          image: parsedUrl,
          date: article.date === '' ? '' : moment(article.date.trim().split(' | ').join(' '), formatString),
          hash_id: hash(article.link),
          category: target.category,
          entity: target.entity
        };
      });

      upper_date = getLowestDate(formattedData);

      console.log(`Finished scrape.`);
      formattedData.map(article => result.push(article));
    }

    // Close the page
    const pages = await browser.pages();
    await Promise.all(pages.map(async (p) => p.close()));
  }

  // Executes synchronously so that it doesn't executes all at one time.
  const completeArticles = [];

  for (const articleData of result) {
    const completeArticle = await scrapeBioBioBody(browser, articleData);
    completeArticles.push(completeArticle);
  }

  const pages = await browser.pages();
  await Promise.all(pages.map(async (p) => p.close()));

  console.log(completeArticles);

  return completeArticles;
}

async function scrapeBioBioBody(browser, articleData) {
  try {
    console.log(`Scrapping ${articleData.link}`);
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });

    await page.goto(articleData.link, { waitUntil: 'load', timeout: 0 });

    const paragraphs = await page.$$eval('div.post-main-aside-container > div > div.post-content.clearfix > div > p', (ps) => {
      // Extract the text content of each <p> element
      return ps.map(p => p.textContent);
    });

    const dateArticle = await page.$eval('#cbb-aux-container > div.post-date', (dateEl) => {
      return dateEl.textContent;
    });

    const screenshotBuffer = await page.screenshot();

    // Upload to S3
    const fileName = `sc_biobiochile-${Date.now()}.png`;
    //await uploadToS3(screenshotBuffer, fileName);

    // Update date in case it wasn't setted up previously
    const updatedArticleData = {
      ...articleData,
      body: paragraphs.join(' '),
      date: dateArticle === '' ? '' : moment(dateArticle.trim().split(' | ').join(' '), formatString),
    }

    const pages = await browser.pages();
    await Promise.all(pages.map(async (p) => p.close()));

    return updatedArticleData;

  } catch (e) {
    console.log(e);
  }
}

/** Util Functions  **/

const uploadToS3 = async (buffer, fileName) => {

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: 'image/png',
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await client.send(command);

    console.log(`File uploaded successfully. https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`);
  } catch (error) {
    console.error('Error uploading file:', error);
  }
};

async function getLastArticleDate(entity, category) {
  const { rows } = await sql`
      SELECT publish_date
      FROM articles 
      WHERE category = ${category} AND source_entity = ${entity} AND publish_date IS NOT NULL
      ORDER BY publish_date desc limit 1;
  `;

  console.log(rows);

  if (rows.length === 0) {
    const nowminus24 = new Date();
    return nowminus24;
  }

  return rows[0].publish_date;
}

async function saveURLs(data) {
  const { hash_id, title, link, date, image, raw_content, body, entity, category } = data;
  const fdate = date === '' ? null : date.format();

  try {
    const result = await sql`
      INSERT INTO articles (article_hash, article_title, category, publish_date, raw_content, article_body, source_entity, article_link)
      VALUES (${hash_id}, ${title}, ${category}, ${fdate}, ${raw_content}, ${body}, ${entity}, ${link});
    `;
    return result;
  } catch (e) {
    return null;
  }
}

/**
  * How this works:
  * 1) Scrapes pages with the list of the latest news.
  * 2) Saves the scrapped URLs, titles, dates, and images.
  * 3) Starts scrapping each individual article's  body, and fills them in the DB from the previous scrape.
  * 4) Uses the body and title to create a summary using Gemini API.
  * 5) Processes the body and title with an NLP estimator to calculate a negativity score and importance score.
  * 6) Data is ready to compose the summary of the latest news articles for the user given it's preferences.
  * */

export const handler = async () => {
  /** Targets **/
  const biobiopages = [
    { "url": "https://www.biobiochile.cl/lista/categorias/nacional", "category": "nacional", "entity": "biobiochile" },
    { "url": "https://www.biobiochile.cl/lista/categorias/economia", "category": "economia", "entity": "biobiochile" }
  ];

  const latercerapages = [
    { "url": "https://www.latercera.com/categoria/nacional/page/1/", "category": "nacional", "entity": "latercera" },
    { "url": "https://www.latercera.com/canal/mundo/", "category": "mundo", "entity": "latercera" }
  ];

  const cnnchilepages = [
    { "url": "https://cnnespanol.cnn.com/category/cono-sur/chile/", "category": "chile", "entity": "cnnespanol" }
  ];

  /** Start **/
  const browser = await initializeBrowser();

  // Get lowest date of the batch scrape for biobiochile

  const biobioarticles = await scrapeBioBioArticles(browser, biobiopages);

  console.log(biobioarticles);

  biobioarticles.map((article) => {
    saveURLs(article);
  });

  await browser.close();
}

handler();
