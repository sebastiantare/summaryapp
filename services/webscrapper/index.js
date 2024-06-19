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
import { GoogleGenerativeAI } from "@google/generative-ai";
import { setTimeout } from "timers/promises";

// Load .env
config();

// Configure S3 Client
const client = new S3Client({});

// Config locale
moment.locale('es');
const formatString = 'dddd DD MMMM, YYYY HH:mm';

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
  // Initialize the lowest date with the first non-empty date or the current date
  let lowest = dates[0].date ? moment(dates[0].date) : moment();

  // Validate the initial lowest date
  if (!lowest.isValid()) {
    lowest = moment();
  }

  for (let i = 1; i < dates.length; i++) {
    if (dates[i].date) {
      let currentDate = moment(dates[i].date);

      // Validate the current date
      if (currentDate.isValid() && currentDate.isBefore(lowest)) {
        lowest = currentDate;
      }
    }
  }

  return lowest.toDate();
}

function isUpperDateGreater(upper, lower) {
  // Parse the dates using Moment.js
  const upperDate = moment(upper);
  const lowerDate = moment(lower);

  // Validate the dates
  if (!upperDate.isValid() || !lowerDate.isValid()) {
    throw new Error('One or both of the dates are invalid.');
  }

  // Compare the dates
  return upperDate.isAfter(lowerDate);
}

//** SCRAPPER FUNCTIONS **//

async function scrapeBioBioArticles(browser, target) {
  console.log('### scrapeBioBioArticles ###');
  var result = [];
  var now_date = new Date();
  var articlesCount = 0;

  console.log(`Starting on target: ${target.url}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(target.url, { waitUntil: 'load', timeout: 0 });

  console.log(`Get last date from vercel`);
  var last_date = await getLastArticleDate(target.entity, target.category);
  const daysDiff = moment.duration(moment(now_date).diff(moment(last_date))).asDays();

  if (daysDiff > 1) {
    console.log(`Date exceeds 24 hours`);
    last_date = new Date();
    last_date.setHours(-24);
  }

  var upper_date = new Date();

  while (isUpperDateGreater(upper_date, last_date)) {
    // Scrap
    console.log(`Processing... ${target.url}`);
    console.log(`${upper_date} > ${last_date}`);

    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      for (let i = 0; i < scrollHeight; i += 100) {
        window.scrollBy(0, 100);
      }
    });

    // Wait for load
    console.log("Waiting...");
    await page.waitForSelector('body > main > div > section > div.section-body > div.results-container > div > div > div.fetch-btn-container > button');
    await page.click('body > main > div > section > div.section-body > div.results-container > div > div > div.fetch-btn-container > button');

    // Take screenshot and get buffer
    console.log("Screnshot");
    const screenshotBuffer = await page.screenshot();

    // Upload to S3
    const fileName = `sc_biobiochile_${target.category}_${Date.now()}.png`;
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

    console.log(`Scrapped for ${target.category}: ${data.length}`);

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

    if (articlesCount === data.length) {
      // Data is not growing in number, thus escape the cycle.
      upper_date = last_date;
    } else {
      upper_date = getLowestDate(formattedData);
      articlesCount = data.length;
    }

    console.log(`Finished scrape with date ${upper_date} > ${last_date}: ${(upper_date > last_date)}`);
    result = formattedData;
  }

  // Close the page
  //const pages = await browser.pages();
  //await Promise.all(pages.map(async (p) => p.close()));
  await page.close();

  return result;
}

async function scrapeBioBioBody(browser, articleData) {
  console.log(`Scrapping ${articleData.link}`);

  // New page
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(articleData.link, { waitUntil: 'load', timeout: 0 });

  const paragraphs = await page.$$eval('div.post-main-aside-container > div > div.post-content.clearfix > div > p', (ps) => {
    return ps.map(p => p.textContent);
  });

  console.log(`Paragraphs: ${paragraphs.length}`);

  const dateArticle = await page.$eval('#cbb-aux-container > div.post-date', (dateEl) => {
    return dateEl.textContent;
  });

  console.log(`Date: ${dateArticle}`);

  //const screenshotBuffer = await page.screenshot();

  // Upload to S3
  //const fileName = `sc_biobiochile-body-${Date.now()}.png`;
  //await uploadToS3(screenshotBuffer, fileName);

  const articleBody = paragraphs.join(' ');

  // Add and update article data
  const updatedArticleData = {
    ...articleData,
    body: articleBody,
    date: articleData.date === '' ? moment(dateArticle.trim().split(' | ').join(' '), formatString) : articleData.date
  }

  //const pages = await browser.pages();
  //await Promise.all(pages.map(async (p) => p.close()));
  await page.close();

  return updatedArticleData;
}

/**** Util Functions  ****/

/** Takes an article and generates a summary in markup **/
async function summarizeArticle(title, body) {
  const prompt = `
    Vas a realizar el trabajo de resumir artículos noticieros siguiendo el siguiente formato:

    Título
    Bulletpoint 1
    Bulletpoint 2
    ...

    Realiza el resumen utilizando la menor cantidad de bulletpoints posibles (max 5). El resumen total no debe superar las 100 palabras total. El resumen debe dar una idea general de qué es lo más importante en la noticia. Reduce la complejidad del artículo utilizando palabras más simples.

    Artículo: "${title} ${body}"
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return text;
}

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

  if (rows.length === 0) {
    const nowminus24 = new Date();
    nowminus24.setHours(-24);
    return nowminus24;
  }

  return rows[0].publish_date;
}

async function saveArticle(data) {
  const { hash_id, title, link, date, image, raw_content, body, entity, category, generated_summary } = data;
  const fdate = date === '' ? null : date.format();

  try {
    const result = await sql`
      INSERT INTO articles (article_hash, article_title, category, publish_date, raw_content, article_body, source_entity, article_link, generated_summary)
      VALUES (${hash_id}, ${title}, ${category}, ${fdate}, ${raw_content}, ${body}, ${entity}, ${link}, ${generated_summary});
    `;
    return result;
  } catch (e) {
    console.log(e);
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
  console.log(`Browser initialized`);

  // Scrape data
  const biobio_1 = await scrapeBioBioArticles(browser, biobiopages[0]);
  const biobio_2 = await scrapeBioBioArticles(browser, biobiopages[1]);

  console.log(biobio_1.length, biobio_2.length);

  // Complete scrape of body
  const biobio_1_complete = [];
  const biobio_2_complete = [];

  for (const bb1 of biobio_1) {
    try {
      const bb1_data = await scrapeBioBioBody(browser, bb1);
      biobio_1_complete.push(bb1_data);
    } catch (e) {
      console.log(e);
    }
  }

  for (const bb2 of biobio_2) {
    try {
      const bb2_data = await scrapeBioBioBody(browser, bb2);
      biobio_2_complete.push(bb2_data);
    } catch (e) {
      console.log(e);
    }
  }

  console.log(biobio_1_complete);
  console.log(biobio_2_complete);

  const biobioarticles = [...biobio_1_complete, ...biobio_2_complete];
  const biobioresult = [];

  var timeout_gemini = 1000;

  // Summarize articles
  for (const article of biobioarticles) {
    try {
      const { title, body } = article;
      const summary = await summarizeArticle(title, body);
      biobioresult.push({ ...article, generated_summary: summary });

      timeout_gemini = 1000;
      await setTimeout(timeout_gemini);
    } catch (e) {
      console.log(`Error while summarizing article: ${e}`);
      timeout_gemini = timeout_gemini * 1.5;

      if (String(e).includes(`SAFETY`)) console.log(article);

      console.log(`Retrying in: ${timeout_gemini}ms`);
      await setTimeout(timeout_gemini);
    }
  }

  // Save articles to vercel db
  for (var i = 0; i < biobioresult.length; i++) {
    try {
      await saveArticle(biobioresult[i]);
    } catch (e) {
      consolee.log(`Error while saving articles to vercel db: ${e}`);
    }
  }

  await browser.close();
}

handler();
