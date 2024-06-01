// https://pptr.dev/supported-browsers
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import proxyPlugin from 'puppeteer-extra-plugin-proxy';
import chromium from '@sparticuz/chromium';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import moment from 'moment';
import { createHash } from 'crypto';

// Moment
moment.locale('es');
const formatString = 'dddd DD MMMM, YYYY HH:mm';

function hash(url) {
  const hash = createHash('md5').update(url).digest('hex');
  return hash.slice(0, 16);
}

async function scrape(url) {
  try {
    puppeteerExtra.use(stealthPlugin);
    puppeteerExtra.use(AdblockerPlugin({ blockTrackers: true }));
    //puppeteerExtra.use(proxyPlugin({
    //  address: '190.153.237.2',
    //  port: 37453
    //}));

    // Local dev test
    //const browser = await puppeteerExtra.launch({
    // headless: 'new',
    //devtools:true,
    //executablePath: "/home/stare/Downloads/chromedriver" //113.0.5672.63
    //executablePath: "/home/stare/.local/share/flatpak/app/com.google.Chrome/current/active/export/bin/com.google.Chrome"
    //});

    // For aws
    const browser = await puppeteerExtra.launch({
      //args: [...chromium.args, '--proxy-server=http://190.153.237.2:37453'],
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });

    // console.log(url);
    await page.goto(url, { waitUntil: 'networkidle2' });
    //await page.goto(url);

    //const frame = page.frames().find(frame => frame.name() === `https://www.biobiochile.cl/lista/categorias/nacional`);

    //await page.waitForSelector('btnClose');
    //await page.evaluate(() => document.getElementById('btnClose').click());

    /*await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      for (let i = 0; i < scrollHeight; i += 100) { // Scroll in increments of 100px
        window.scrollBy(0, 100);
      }
    });*/

    //await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    /*const test = await page.evaluate(_ => {
      return document.querySelector('article').textContent;
    });

    console.log(test);*/

    const articlesData = await page.waitForSelector('article');

    // console.log(articlesData);

    const data = await articlesData.evaluate(_ => {
      return {
        title: document.querySelector('a').outerText,
        content: document.querySelector('h2').textContent,
      };
    });

    // console.log(data);

    // Titles

    const titleArticle = await page.$$('div > div > a > h2', articlesData);

    const titleData = Array.from(titleArticle);

    const titles = await Promise.all(titleData.map(async (t) => {
      return await t.evaluate(_ => _.textContent);
    }));

    // console.log(titles);

    // Links

    const linkArticle = await page.$$('div > .article-text-container > a', articlesData);

    const linkData = Array.from(linkArticle);

    const links = await Promise.all(linkData.map(async (l) => {
      return await l.evaluate(_ => _.href);
    }));

    // console.log(links);

    const hash_id = hash(links.join());

    // Date

    const dateArticle = await page.$$('div > div > div.article-date-hour', articlesData);

    const dataDateArticle = Array.from(dateArticle);

    const dates = await Promise.all(dataDateArticle.map(async (d) => {
      return await d.evaluate(_ => _.textContent);
    }));

    const parsedDates = dates.map(d => moment(d.trim().split(' | ').join(' '), formatString));

    // console.log(parsedDates);

    // Screenshot

    // await page.screenshot({ path: `sc_${hash_id}.png`, fullPage: false })

    // Close

    const pages = await browser.pages();

    await Promise.all(pages.map(async (p) => p.close()));

    await browser.close();

    const result = {
      titles,
      links,
      parsedDates,
      data
    };

    return result;

  } catch (error) {
    console.log("error at scrape", error.message);
  }
}

export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const { url } = body;

    const data = await scrape(url);

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.log("error at index.js", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      }),
    };
  }
};

handler({
  body: JSON.stringify({
    url: `https://www.biobiochile.cl/lista/categorias/nacional`,
  })
})
