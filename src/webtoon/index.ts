import axios from 'axios';
import puppeteer, { Page } from 'puppeteer';
import cheerio from 'cheerio';
import { connectDB } from '../module/database';
import { ObjectId } from 'mongodb';

const type = 'webtoon';

interface ApiData {
  webtoonId: string;
  title: string;
  author: string;
  url: string;
  img: string;
  service: string;
  updateDays: string[];
  additional: {
    new: boolean;
    adult: boolean;
    rest: boolean;
    up: boolean;
    singularityList: string[];
  };
}

interface WebToonData {
  _id?: ObjectId;
  type: 'webtoon';
  webtoonId: string;
  title: string;
  summary: string;
  genre: string[];
  author: string;
  url: { [key: string]: string };
  img: string;
  backdrop_img?: string;
  service: string[];
  updateDays: string[];
  rate: number;
  rates: { user: string; rate: number; comment: string | null }[];
  additional: {
    new: boolean;
    adult: boolean;
    rest: boolean;
    up: boolean;
    singularityList: string[];
  };
}

async function Crawl(
  page: Page,
  service: string
): Promise<{ genre: string[]; summary: string }> {
  const content = await page.content();
  const $ = cheerio.load(content);

  let data: { genre: string[]; summary: string; backdrop_img?: string };

  if (service === 'naver') {
    data = {
      genre: $('#content > div > div > div > div > div')
        .find('a')
        .text()
        .split('#')
        .splice(1),
      summary: $('#content > div > div > div').find('p').text(),
    };
  } else if (service === 'kakao') {
    data = {
      genre: $(
        '#root > main > div > div > div > div > div > div > div:nth-child(3) > div'
      )
        .find('a')
        .text()
        .split('#')
        .splice(1),
      summary: $(
        '#root > main > div > div > div > div > div > div > div:nth-child(2) > div'
      )
        .find('p')
        .text(),
      backdrop_img: $('#root > main > div > div > picture')
        .find('img')
        .attr('src'),
    };
  }

  return data;
}

async function GetWebToon(
  page: number,
  service: string,
  updateDay: string
): Promise<ApiData[]> {
  const apiData: ApiData = {
    webtoonId: '',
    title: '',
    author: '',
    url: '',
    img: '',
    service: '',
    updateDays: [],
    additional: {
      new: false,
      adult: false,
      rest: false,
      up: false,
      singularityList: [],
    },
  };
  const webtoonList: ApiData[] = [];
  await axios
    .get('https://korea-webtoon-api.herokuapp.com', {
      params: { page: page, service: service, updateDay: updateDay },
    })
    .then((res) => {
      if (res.status == 200) {
        for (let i in res.data.webtoons) {
          for (let key of Object.keys(apiData)) {
            apiData[key] = res.data.webtoons[parseInt(i)][key];
          }
          webtoonList.push({ ...apiData });
        }
      }
    });
  return webtoonList;
}

async function CrawWebToonData(
  page: Page,
  min: number,
  service: 'naver' | 'kakao',
  updateDay:
    | 'mon'
    | 'tue'
    | 'wed'
    | 'thu'
    | 'fri'
    | 'sat'
    | 'sun'
    | 'finished'
    | 'naverDaily'
) {
  const db = (await connectDB).db('LikeOTT');
  const apiData = await GetWebToon(min, service, updateDay);

  for (let webtoon of apiData) {
    if (webtoon.additional.adult) continue; //성인 웹툰은 로그인 인증을 해야 함으로 pass

    if (webtoon.url && service === 'kakao') {
      webtoon['url'] += '?tab=profile';
    } else if (webtoon.url && service === 'naver') {
      webtoon['url'] = webtoon.url.replace(/m.comic/, 'comic');
    }

    await page.goto(webtoon.url, {
      waitUntil: 'networkidle0',
    });

    let streamData: WebToonData = {
      type: type,
      webtoonId: '',
      title: '',
      summary: '',
      genre: [],
      author: '',
      url: {},
      img: '',
      service: [],
      updateDays: [],
      rate: 0,
      rates: [],
      additional: {
        new: false,
        adult: false,
        rest: false,
        up: false,
        singularityList: [],
      },
    };
    const result = await db.collection('media').findOne({
      type: type,
      title: webtoon.title,
    });
    if (result) {
      delete result._id;
      for (let key of Object.keys(result)) {
        streamData[key] = result[key];
      }
    } else {
      for (let key of Object.keys(webtoon)) {
        if (key === 'service') {
          streamData[key].push(webtoon[key]);
        } else if (key === 'url') {
          streamData[key][service] = webtoon[key];
        } else {
          streamData[key] = webtoon[key];
        }
      }
    }

    const crawlData = await Crawl(page, service); // 현재 페이지 크롤링 해서 장르 및 줄거리 가져오기

    if (crawlData) {
      // 크롤 데이터가 있다면 밑에 구문 실행
      for (let key of Object.keys(crawlData)) {
        if (crawlData[key] instanceof Array) {
          let temp = streamData[key].concat(crawlData[key]);
          temp.filter((item, position) => temp.indexOf(item) === position);
          streamData[key] = temp;
        } else {
          streamData[key] = crawlData[key];
        }
      }
    }

    if (result) {
      await db
        .collection('media')
        .updateOne({ webtoonId: streamData.webtoonId }, { $set: streamData });
    } else {
      await db.collection('media').insertOne(streamData);
    }
  }
}

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

export { CrawWebToonData };
