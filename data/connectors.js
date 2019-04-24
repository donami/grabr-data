import Sequelize from 'sequelize';
import casual from 'casual';
import _ from 'lodash';
import fetch from 'node-fetch';
// import Mongoose from 'mongoose';
import { psFetcher, hsnFetcher, newEggFetcher } from './resolvers';
import { NewEggCrawler } from 'grabr-crawler';

const production = process.env.DATABASE_URL ? true : false;

// const db = new Sequelize(process.env.DATABASE_URL, {
//   ssl: true,
//   // native: true,
//   // Look to the next section for possible options
// });

// var db = new Sequelize('postgresql://postgres:hejsan@localhost/grabr', {
// var db = new Sequelize(process.env.DATABASE_URL, {
var db = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://postgres:hejsan@localhost/grabr',
  {
    dialect: 'postgres',
    dialectOptions: {
      ssl: production ? true : false,
    },
  }
);

// const db = new Sequelize('blog', null, null, {
//   dialect: 'sqlite',
//   storage: './grabr3.sqlite',
//   // storage: './blog.sqlite',
//   retry: {
//     max: 40,
//   },
// });

const AuthorModel = db.define('author', {
  firstName: { type: Sequelize.STRING },
  lastName: { type: Sequelize.STRING },
});

const PostModel = db.define('post', {
  title: { type: Sequelize.STRING },
  text: { type: Sequelize.STRING },
});

const ProductModel = db.define('product', {
  title: { type: Sequelize.STRING },
  image: { type: Sequelize.STRING },
  main: { type: Sequelize.INTEGER, defaultValue: 0 },
});

const SiteModel = db.define('site', {
  title: { type: Sequelize.STRING },
  url: { type: Sequelize.STRING },
});

const ListingModel = db.define('listing', {
  url: { type: Sequelize.STRING },
  site: { type: Sequelize.STRING },
  price: { type: Sequelize.FLOAT },
});

const CategoryModel = db.define('category', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
  root: { type: Sequelize.BOOLEAN, defaultValue: true },
  parent: { type: Sequelize.INTEGER },
});

const FetcherModel = db.define('fetcher', {
  url: { type: Sequelize.STRING },
  lastFetched: { type: Sequelize.STRING },
  // site: { type: Sequelize.STRING },
});

const FilterModel = db.define('filter', {
  key: { type: Sequelize.STRING },
  values: { type: Sequelize.STRING },
  // values: { type: Sequelize.ARRAY(Sequelize.STRING) },
});
// const FilterKeyModel = db.define('filterKey', {
//   key: { type: Sequelize.STRING },
// });
// const FilterValueModel = db.define('filterValue', {
//   value: { type: Sequelize.STRING },
// });

AuthorModel.hasMany(PostModel, { as: 'posts' });
PostModel.belongsTo(AuthorModel);

// FilterModel.hasMany(FilterKeyModel, {
//   as: 'key',
//   through: 'Filter_FilterKeys',
// });
// FilterKeyModel.belongsToMany(FilterModel, {
//   through: 'Filter_FilterKeys',
// });
// FilterModel.hasOne(FilterKeyModel, { as: 'key' });
// FilterModel.hasMany(FilterValueModel, { as: 'values' });

SiteModel.hasMany(FetcherModel, { as: 'fetchers' });
CategoryModel.hasMany(ProductModel);
CategoryModel.hasMany(CategoryModel, { as: 'children', foreignKey: 'parent' });
// CategoryModel.hasMany(CategoryModel, { as: 'children', foreignKey: 'parent' });
CategoryModel.hasMany(FetcherModel);
FetcherModel.belongsTo(CategoryModel);
FetcherModel.belongsTo(SiteModel);
ProductModel.belongsTo(CategoryModel);
ProductModel.hasMany(FilterModel, { as: 'filters' });
ProductModel.hasMany(ListingModel, { as: 'listings' });
ListingModel.belongsTo(ProductModel);

// Mongoose.Promise = global.Promise;

// const mongo = Mongoose.connect('mongodb://localhost/views', {
//   useMongoClient: true,
// });

// const ViewSchema = Mongoose.Schema({
//   postId: Number,
//   views: Number,
// });

// const View = Mongoose.model('views', ViewSchema);

const Author = db.models.author;
const Post = db.models.post;
const Product = db.models.product;
const Category = db.models.category;
const Fetcher = db.models.fetcher;
const Listing = db.models.listing;
const Filter = db.models.filter;
const Site = db.models.site;
// const FilterKey = db.models.filterKey;
// const FilterValue = db.models.filterValue;

const _fetchers = [
  {
    // id: 1,
    url: 'https://www.proshop.se/Naetverkskabel',
    site: 'Proshop',
    // categoryId: 1,
  },
  {
    // id: 2,
    url: 'https://www.proshop.se/Baerbar',
    site: 'Proshop',
    // categoryId: 2,
  },
  {
    // id: 2,
    url:
      'https://www.newegg.com/Product/ProductList.aspx?Submit=StoreIM&Depa=1&Category=34',
    site: 'NewEgg',
    // categoryId: 2,
  },
  {
    // id: 2,
    url:
      'https://www.hsn.com/shop/cameras-photo-and-video/ec0405?skip=0&take=60&page=1&view=all&sort=',
    site: 'HSN',
    // categoryId: 2,
  },
];

// modify the mock data creation to also create some views:
casual.seed(123);
db.sync({ force: true }).then(async () => {
  const proshopSite = await SiteModel.create({
    title: 'Proshop',
    url: 'https://proshop.se',
  });
  const neweggSite = await SiteModel.create({
    title: 'NewEgg',
    url: 'https://newegg.com',
  });
  const hsnSite = await SiteModel.create({
    title: 'HSN',
    url: 'https://hsn.com',
  });

  await FilterModel.create({ key: 'Size', values: 'XL, L' });

  await CategoryModel.create({
    title: 'Cameras',
    root: true,
  }).then(async category => {
    const fetcher = await FetcherModel.create(_fetchers[3]);

    return Promise.all([
      fetcher.setCategory(category),
      fetcher.setSite(hsnSite),
    ]);
  });

  await CategoryModel.create({
    title: 'Computer Parts',
    root: true,
  }).then(async computerPartsCategory => {
    return CategoryModel.create({
      title: 'CPUs / Processors',
      root: false,
    }).then(async category => {
      category.update({ parent: computerPartsCategory.id });
      await category.save();

      const fetcher = await FetcherModel.create(_fetchers[2]);
      return Promise.all([
        fetcher.setCategory(category),
        fetcher.setSite(neweggSite),
      ]);
    });
  });

  await CategoryModel.create({
    title: 'Cables',
  }).then(async category => {
    const fetcher = await FetcherModel.create(_fetchers[0]);
    return Promise.all([
      fetcher.setCategory(category),
      fetcher.setSite(proshopSite),
    ]);
  });

  await CategoryModel.create({
    title: 'Laptops',
  }).then(async category => {
    const childCategory = await CategoryModel.create({
      title: 'MacBook',
      root: false,
    });
    const anotherChild = await CategoryModel.create({
      title: 'Small MacBooks',
      root: false,
    });
    const largeMacBooks = await CategoryModel.create({
      title: 'Large MacBooks',
      root: false,
    });

    await childCategory.setChildren([anotherChild, largeMacBooks]);

    await category.setChildren([childCategory]);

    const fetcher = await FetcherModel.create(_fetchers[1]);
    return Promise.all([
      fetcher.setCategory(category),
      fetcher.setSite(proshopSite),
    ]);
  });

  const fetchers = await Fetcher.findAll({
    include: [
      {
        model: Site,
        as: 'site',
      },
    ],
  });

  const promises = fetchers.map(fetcher => {
    if (fetcher.site.title === 'Proshop') {
      return psFetcher({
        url: fetcher.url,
        site: fetcher.site,
        categoryId: fetcher.categoryId,
      });
    } else if (fetcher.site.title === 'NewEgg') {
      return newEggFetcher({
        url: fetcher.url,
        site: fetcher.site,
        categoryId: fetcher.categoryId,
      });
    } else if (fetcher.site.title === 'HSN') {
      return hsnFetcher({
        url: fetcher.url,
        site: fetcher.site,
        categoryId: fetcher.categoryId,
      });
    }
    return Promise.resolve();
  });

  await Promise.all(promises);

  const listing = await Listing.findOne({
    where: { site: 'NewEgg' },
    include: [
      {
        model: Product,
        as: 'product',
      },
    ],
  });
  const getFilters = listing => {
    return new Promise(async resolve => {
      const crawler = new NewEggCrawler();

      if (!listing) {
        return resolve();
      }

      const res = await crawler.crawlProduct(listing.url);

      const filters = await Promise.all(
        (res || []).map(item => {
          return Filter.create(item).then(item => {
            return item.id;
          });
        })
      );

      const product = await Product.findById(listing.product.id);

      await product.setFilters(filters);

      await product.save();

      return resolve();
    });
  };

  await getFilters(listing);

  return Promise.resolve();
});

export {
  Author,
  Product,
  Category,
  Listing,
  Post,
  Filter,
  // FilterKey,
  // FilterValue,
  Site,
  Fetcher,
  // View,
};
