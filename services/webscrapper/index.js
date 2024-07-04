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
import { StopInstancesCommand } from "@aws-sdk/client-ec2";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { setTimeout } from "timers/promises";
import fetch from 'node-fetch';
import pino from 'pino';
import axios from 'axios';
import { EC2Client } from "@aws-sdk/client-ec2";

// EC2 Conf
const REGION = "sa-east-1";
const awsClient = new EC2Client({ region: REGION });

// Load .env
config();

const now = Date.now();

// Configure S3 Client
const client = new S3Client({});

// Config locale
moment.locale('es');
const formatString = 'dddd DD MMMM, YYYY HH:mm';

const logger = pino();

// Gemini
const safetySetting = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: safetySetting });

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
    });

    //executablePath: "/home/stare/Downloads/chromedriver" //113.0.5672.63
    //executablePath: "/home/stare/.local/share/flatpak/app/com.google.Chrome/current/active/export/bin/com.google.Chrome"
    //args: [...chromium.args, '--proxy-server=http://190.153.237.2:37453'],

    // For aws serverless
    /*const browser = await puppeteerExtra.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });*/

    // For aws nonserverless
    /*const browser = await puppeteerExtra.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null,
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      ignoreHTTPSErrors: true
    });*/

    return browser;

  } catch (error) {
    logger.info("Error with browser", error);
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

async function scrapeLaTerceraArticles(browser, target) {
  logger.info('### scrapeLaTerceraArticles ###');
  var result = [];
  var now_date = new Date();
  var articlesCount = 0;
  var pageCount = 1; //This works better instead of clicking the next button latercerapage/{pageCount}

  logger.info(`Starting on target: ${target.url}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(target.url, { waitUntil: 'load', timeout: 30000 });

  logger.info(`Get last date from vercel`);
  var last_date = await getLastArticleDate(target.entity, target.category);
  const daysDiff = moment.duration(moment(now_date).diff(moment(last_date))).asDays();

  if (daysDiff > 1) {
    logger.info(`Date exceeds 24 hours`);
    last_date = new Date();
    last_date.setHours(-24);
  }

  var upper_date = new Date();

  while (isUpperDateGreater(upper_date, last_date)) {
    // Scrap
    logger.info(`Processing... ${target.url}`);
    logger.info(`${upper_date} > ${last_date}`);

    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      for (let i = 0; i < scrollHeight; i += 100) {
        window.scrollBy(0, 100);
      }
    });

    // Take screenshot and get buffer
    //logger.info("Screnshot");
    const screenshotBuffer = await page.screenshot();

    // Upload to S3
    const fileName = `sc_biobiochile_${target.category}_${Date.now()}.png`;
    await uploadToS3(screenshotBuffer, fileName);

    //logger.info(`Uploaded to S3 ${fileName}`);

    logger.info("Begin scrape");

    // Begin scrape

    const articles = await page.$$('article');

    //body > main > div > section > div.section-body > div.highlight > article
    //body > main > div > section > div.section-body > div.results-container > div > article:nth-child(1)

    const data = await Promise.all(articles.map(async (article) => {
      return article.evaluate(articleEl => {
        const aTitle = articleEl.querySelector('div.headline.\|.width_full.hl > h3 > a')?.textContent;

        // Skip the article if it doesn't have a title
        if (!aTitle) {
          return null;
        }

        return {
          title: aTitle.trim(),
          link: articleEl.querySelector('h3 > a')?.href || '',
          /** Warning: Date is not available when scrapping the header article. **/
          date: articleEl.querySelector('div.byline.\|.undefined.isText.width_full > div.time')?.textContent || '',
          image: articleEl.querySelector('figure > a > picture > img')?.src || '',
          raw_content: articleEl.outerHTML || ''
        };
      });
    }));

    logger.info(data);
    //...

    logger.info(`Scrapped for ${target.category}: ${data.length}`);

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

    logger.info(`Finished scrape with date ${upper_date} > ${last_date}: ${(upper_date > last_date)}`);
    result = formattedData;
  }

  // Close the page
  //const pages = await browser.pages();
  //await Promise.all(pages.map(async (p) => p.close()));
  await page.close();

  return result;
}

/* BIOBIO */
async function scrapeBioBioArticles(browser, target) {
  logger.info('### scrapeBioBioArticles ###');
  var result = [];
  var now_date = new Date();
  var articlesCount = 0;

  logger.info(`Starting on target: ${target.url}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(target.url, { waitUntil: 'load', timeout: 30000 });

  logger.info(`Get last date from vercel`);
  var last_date = await getLastArticleDate(target.entity, target.category);
  const daysDiff = moment.duration(moment(now_date).diff(moment(last_date))).asDays();

  if (daysDiff > 1) {
    logger.info(`Date exceeds 24 hours`);
    last_date = new Date();
    last_date.setHours(-24);
  }

  var upper_date = new Date();

  while (isUpperDateGreater(upper_date, last_date)) {
    // Scrap
    logger.info(`Processing... ${target.url}`);
    logger.info(`${upper_date} > ${last_date}`);

    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      for (let i = 0; i < scrollHeight; i += 100) {
        window.scrollBy(0, 100);
      }
    });

    // Wait for load
    logger.info("Waiting...");
    try {
      await page.waitForSelector('body > main > div > section > div.section-body > div.results-container > div > div > div.fetch-btn-container > button');
      await page.click('body > main > div > section > div.section-body > div.results-container > div > div > div.fetch-btn-container > button');
    } catch (e) {
      logger.error(`Error while waiting for button`, e);
      continue;
    }

    // Take screenshot and get buffer
    //logger.info("Screnshot");
    const screenshotBuffer = await page.screenshot();

    // Upload to S3
    const fileName = `sc_biobiochile_${target.category}_${Date.now()}.png`;
    await uploadSCToS3(screenshotBuffer, fileName);

    //logger.info(`Uploaded to S3 ${fileName}`);

    logger.info("Begin scrape");

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

    logger.info(`Scrapped for ${target.category}: ${data.length}`);

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

    logger.info(`Finished scrape with date ${upper_date} > ${last_date}: ${(upper_date > last_date)}`);
    result = formattedData;
  }

  // Close the page
  //const pages = await browser.pages();
  //await Promise.all(pages.map(async (p) => p.close()));
  await page.close();

  return result;
}

async function scrapeBioBioBody(browser, articleData) {
  logger.info(`Scrapping ${articleData.link}`);

  // New page
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(articleData.link, { waitUntil: 'load', timeout: 30000 });

  const paragraphs = await page.$$eval('div > p', (ps) => {
    return ps.map(p => p.textContent);
  });

  logger.info(`Paragraphs: ${paragraphs.length}`);

  const dateArticle = await page.$eval('#cbb-aux-container > div.post-date', (dateEl) => {
    return dateEl.textContent;
  });

  logger.info(`Date: ${dateArticle}`);

  const idNota = await page.$eval(`head`, (head) => {
    return head.getAttribute('data-id-nota');
  });

  /*
  [
  {
    "NotaId": 6133281,
    "Fecha": {
      "$date": {
        "$numberLong": "1718740029"
      }
    },
    "Categorias": [
      "nacional",
      "chile"
    ],
    "Tags": [
      "apoyo-a-familias",
      "armas-incautadas",
      "bio-bio",
      "corrupcion-en-carabineros-ricardo-yanez",
      "cuenta-publica-2023",
      "departamento-b9",
      "detenciones-en-chile",
      "drogas-decomisadas",
      "extranjeros-en-delitos",
      "fundacion-paz-y-familia",
      "gestion-2023",
      "incautaciones",
      "institucion-carabineros",
      "martires-de-carabineros",
      "ministerio-publico",
      "ninos-y-adolescentes-en-delitos",
      "organizaciones-criminales-desbaratadas",
      "region-metropolitana",
      "valparaiso"
    ],
    "Autor": "Florencia Ortiz",
    "CoAutores": "",
    "Publishers": [
      "Carlos Godoy"
    ],
    "Colaborators": "",
    "Titulo": "Cuenta pública de Carabineros: aumentó el número de secuestros y menores que delinquen",
    "CatPrimary": "nacional",
    "CatSecondary": "chile",
    "Visitas": 13761
  }
  ]
  */

  const response = await fetch(`https://contador.biobiochile.cl/api/visitas/get-visitas?idNota=${idNota}`);
  const fetchData = await response.json();
  const viewCount = fetchData[0].Visitas || null;

  logger.info(`View Count: ${viewCount}`);

  //const screenshotBuffer = await page.screenshot();

  // Upload to S3
  //const fileName = `sc_biobiochile-body-${Date.now()}.png`;
  //await uploadToS3(screenshotBuffer, fileName);

  const articleBody = paragraphs.join(' ');

  // Add and update article data
  const updatedArticleData = {
    ...articleData,
    body: articleBody,
    date: articleData.date === '' ? moment(dateArticle.trim().split(' | ').join(' '), formatString) : articleData.date,
    views: viewCount,
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

const uploadSCToS3 = async (buffer, fileName) => {

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: 'image/png',
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await client.send(command);

    logger.info(`File uploaded successfully. https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`);
  } catch (error) {
    logger.error('Error uploading file:', error);
  }
};

async function uploadToS3(imageUrl, fileName) {
  try {
    logger.info(`Uploading ${imageUrl}`);
    // Download the image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    // Set up the S3 upload parameters
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png'
    };

    const command = new PutObjectCommand(params);
    const result = await client.send(command);

    logger.info(`File uploaded successfully. https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`);

    return result;
  } catch (error) {
    console.error(`Error uploading ${imageUrl}: ${error.message}`);
  }
}

async function saveImage(data) {
  const { hash_id, image } = data;
  const image_hash = hash(image);
  try {
    const result = await sql`
      INSERT INTO header_images (article_hash, image_hash, s3_link) VALUES (${hash_id}, ${image_hash}, ${image});
    `;
    return result;
  } catch (e) {
    logger.error(e);
  }
}

/**
  * Retrieves the latest articles hash so it doesn't prcess already existing articles
  */
async function getLatestArticles() {
  // I do 48 hours to ensure all ids are considered
  const { rows } = await sql`
    SELECT article_hash, category, source_entity
    FROM articles
    WHERE publish_date >= NOW() - INTERVAL '48 hours';
  `;

  return rows;
}

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
  const { hash_id, title, link, date, image, raw_content, body, entity, category, generated_summary, views } = data;
  const fdate = date === '' ? null : date.format();

  try {
    const result = await sql`
      INSERT INTO articles (article_hash, article_title, category, publish_date, raw_content, article_body, source_entity, article_link, generated_summary, view_count)
      VALUES (${hash_id}, ${title}, ${category}, ${fdate}, ${raw_content}, ${body}, ${entity}, ${link}, ${generated_summary}, ${views});
    `;
    return result;
  } catch (e) {
    logger.error(e);
    logger.error({ hash_id, title });
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
  logger.info(`Browser initialized`);

  /* Get the latest ids in 24 hours window to skip 
  /* scraping & summarizing already existing articles.
    */
  const latestIds = await getLatestArticles();

  const hashMap = Object.values(latestIds).reduce((map, article) => {
    map[article.article_hash] = article;
    return map;
  }, {});

  // Scrape data
  const biobio_1 = await scrapeBioBioArticles(browser, biobiopages[0]);
  const biobio_2 = await scrapeBioBioArticles(browser, biobiopages[1]);

  logger.info(`Articles:`, biobio_1.length, ' and ', biobio_2.length);

  // Complete scrape of body of unseen articles
  const biobio_1_complete = [];
  const biobio_2_complete = [];


  logger.info(`Biobio 0/2`);

  for (const bb1 of biobio_1) {
    try {
      if (hashMap[bb1.hash_id] !== undefined) continue;
      const bb1_data = await scrapeBioBioBody(browser, bb1);
      biobio_1_complete.push(bb1_data);
    } catch (e) {
      logger.error(e);
    }
  }

  logger.info(`Biobio 1/2`);

  for (const bb2 of biobio_2) {
    try {
      if (hashMap[bb2.hash_id] !== undefined) continue;
      const bb2_data = await scrapeBioBioBody(browser, bb2);
      biobio_2_complete.push(bb2_data);
    } catch (e) {
      logger.error(e);
    }
  }

  logger.info(`Biobio 2/2`);

  const biobioarticles = [...biobio_1_complete, ...biobio_2_complete];
  const biobioresult = [];

  var timeout_gemini = 1000;

  // Summarize articles
  logger.info(`Summarizing ${biobioarticles.length} articles...`);
  let a = 0;
  for (const article of biobioarticles) {
    a++;
    try {
      const { title, body } = article;
      const summary = await summarizeArticle(title, body);
      //biobioresult.push({ ...article, generated_summary: summary });
      await saveArticle({ ...article, generated_summary: summary });

      timeout_gemini = 1000;
      await setTimeout(timeout_gemini);
    } catch (e) {
      logger.error(`Error while summarizing article: ${e}`);
      timeout_gemini = timeout_gemini * 1.5;
      if (timeout_gemini > 1000 * 180) timeout_gemini = 1000 * 180;

      logger.info(`Retrying in: ${timeout_gemini}ms`);
      await setTimeout(timeout_gemini);
    }
  }

  // Upload Images to S3
  logger.info(`Downloading Images to S3`);

  for (const article of biobioarticles) {
    try {
      await uploadToS3(article.image, `s3_${article.hash_id}.png`);
    } catch (e) {
      logger.error(`Error while downloading image to s3`, e);
    }
  }

  // Save articles to vercel db
  /*for (var i = 0; i < biobioresult.length; i++) {
    try {
      await saveArticle(biobioresult[i]);
      //await saveImage(biobioresult[i]);
    } catch (e) {
      logger.error(`Error while saving articles to vercel db: ${e}`);
    }
  }*/
  logger.info(`Done.`);
  await browser.close();
}

const ShutdownInstance = async () => {
  const end = Date.now();
  logger.info(`Finished scraping after ${(end - now) / 1000} seconds`);

  const command = new StopInstancesCommand({
    InstanceIds: [process.env.INSTANCE_ID],
  });

  try {
    const { StoppingInstances } = await awsClient.send(command);
    const instanceIdList = StoppingInstances.map(
      (instance) => ` • ${instance.InstanceId}`,
    );
    logger.info("Stopping instances:");
    logger.info(instanceIdList.join("\n"));
  } catch (err) {
    logger.error(err);
  }
};

handler()
  .then(() => ShutdownInstance())
  .catch((e) => {
    logger.info(e);
    ShutdownInstance();
  });
