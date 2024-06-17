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
  const h = createHash('md5').update(url).digest('hex');
  return h.slice(0, 16);
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

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.goto(url, { waitUntil: 'load' });

    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      for (let i = 0; i < scrollHeight; i += 100) { // Scroll in increments of 100px
        window.scrollBy(0, 100);
      }
    });

    //await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await page.screenshot({ path: `sc_biobio.png`, fullPage: false })

    const articles = await page.$$('article');

    var data = await Promise.all(articles.map(async article => {
      return article.evaluate(articleEl => {
        return {
          title: articleEl.querySelector('div > div > a > h2')?.textContent || '',
          link: articleEl.querySelector('div > .article-text-container > a')?.href || '',
          date: articleEl.querySelector('div > div > div.article-date-hour')?.textContent || '',
          image: articleEl.querySelector('a > div.article-image')?.style.backgroundImage || '',
        };
      });
    }));

    const formattedData = data.map(article => {
      let parsedUrl = article.image;

      const urlMatch = article.image.match(/url\(["']?(.*?)["']?\)/);
      if (urlMatch && urlMatch.length > 1) {
        parsedUrl = urlMatch[1];
      }

      return {
        ...article,
        image: parsedUrl,
        date: moment(article.date.trim().split(' | ').join(' '), formatString),
        hash_id: hash(article.link)
      };
    });

    const pages = await browser.pages();

    await Promise.all(pages.map(async (p) => p.close()));

    await browser.close();

    return formattedData;
  } catch (error) {
    console.log("error at scrape", error.message);
  }
}

export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const { url } = body;

    const data = await scrape(url);

    console.log(data);

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


//Development
handler({
  body: JSON.stringify({
    url: `https://www.biobiochile.cl/lista/categorias/nacional`,
  })
})
