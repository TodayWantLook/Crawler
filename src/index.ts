import puppeteer from 'puppeteer';

import { getTMDBData } from './video';
import { CrawWebToonData } from './webtoon';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-notifications',
      '--disable-extensions',
    ],
  });
  const page = await browser.newPage();

  await CrawWebToonData(page, 1, 'kakao', 'finished');
})();
