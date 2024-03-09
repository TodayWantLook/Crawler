import axios from 'axios';
import { config } from 'dotenv';
import { connectDB } from '../module/database';

config();

const type = 'video';

interface ApiData {
  videoId: number;
  type: 'video';
  title: string;
  summary: string;
  backdrop: string;
  img: string;
  genre: string[];
  rate: number;
  rates: { user: string; rate: number; comment: string | null }[];
}

const genres: { id: number; name: string }[] = [
  {
    id: 28,
    name: '액션',
  },
  {
    id: 12,
    name: '모험',
  },
  {
    id: 16,
    name: '애니메이션',
  },
  {
    id: 35,
    name: '코미디',
  },
  {
    id: 80,
    name: '범죄',
  },
  {
    id: 99,
    name: '다큐멘터리',
  },
  {
    id: 18,
    name: '드라마',
  },
  {
    id: 10751,
    name: '가족',
  },
  {
    id: 14,
    name: '판타지',
  },
  {
    id: 36,
    name: '역사',
  },
  {
    id: 27,
    name: '공포',
  },
  {
    id: 10402,
    name: '음악',
  },
  {
    id: 9648,
    name: '미스터리',
  },
  {
    id: 10749,
    name: '로맨스',
  },
  {
    id: 878,
    name: 'SF',
  },
  {
    id: 10770,
    name: 'TV 영화',
  },
  {
    id: 53,
    name: '스릴러',
  },
  {
    id: 10752,
    name: '전쟁',
  },
  {
    id: 37,
    name: '서부',
  },
];

async function getTMDBData(page: number) {
  const db = (await connectDB).db('LikeOTT');
  const movieList: ApiData[] = [];

  await axios
    .get(
      `https://api.themoviedb.org/3/movie/top_rated?language=ko&region=KR&page=${page}`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `${process.env.TMDB_KEY}`,
        },
      }
    )
    .then((res) => {
      if (res.status == 200) {
        for (let data of res.data.results) {
          const apiData: ApiData = {
            videoId: 0,
            type: type,
            title: '',
            summary: '',
            backdrop: '',
            img: '',
            genre: [],
            rate: 0,
            rates: [],
          };

          let genreData: string[] = [];
          for (let genre of data.genre_ids) {
            genreData.push(
              genres.find((item: { id: number; name: string }) => {
                return item.id === genre;
              }).name
            );
          }

          for (let key of ['poster_path', 'backdrop_path']) {
            data[key] = 'https://image.tmdb.org/t/p/w400' + data[key];
          }

          delete data['genre_ids'];
          data['genre'] = genreData;

          let temp = data['overview'];
          data['summary'] = temp;
          delete data['overview'];

          temp = data['poster_path'];
          data['img'] = temp;
          delete data['poster_path'];

          temp = data['id'];
          data['videoId'] = temp;
          delete data['id'];

          for (let key of Object.keys(apiData)) {
            if (data[key]) apiData[key] = data[key];
          }
          movieList.push(apiData);
        }
      }
    });
  if (movieList) {
    for (let data of movieList) {
      const result = await db.collection('media').findOne({
        type: type,
        title: data.title,
      });

      if (result) {
        await db
          .collection('media')
          .updateOne({ videoId: data.videoId }, { $set: data });
      } else {
        await db.collection('media').insertOne(data);
      }
    }
  }
}

export { getTMDBData };
