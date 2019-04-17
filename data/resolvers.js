import {
  Author,
  Product,
  Category,
  Listing,
  View,
  Fetcher,
  Filter,
  Site,
} from './connectors';
import { getUniqueFilters, filterProductsByFilter } from '../lib/helpers';
import { Op } from 'sequelize';
import { NewEggCrawler, HSNCrawler, ProshopCrawler } from 'grabr-crawler';

const debugModel = model => {
  for (let assoc of Object.keys(model.associations)) {
    for (let accessor of Object.keys(model.associations[assoc].accessors)) {
      console.log(
        model.name + '.' + model.associations[assoc].accessors[accessor] + '()'
      );
    }
  }
};

const handleCrawledItems = (items, options) => {
  const { site, categoryId } = options;

  return items.map(item => {
    // check if product exists
    return Product.findOrBuild({
      where: { title: item.title },
      defaults: {
        image: item.image,
      },
    }).spread(async (product, created) => {
      // if product did not exist, create new one
      if (product && created) {
        if (categoryId) {
          const category = await Category.findOne({
            where: { id: categoryId },
          });

          await product.setCategory(category);
        }

        await product.createListing({
          site: site.title,
          url: item.url,
          price: item.price,
        });

        await product.save();

        return Product.findOne({ id: product.id });
      }

      // if product exists update existing
      if (product && !created) {
        const productListings = await product.getListings({
          where: {
            url: item.url,
          },
        });

        if (productListings.length) {
          productListings[0].update({ price: item.price });
        } else {
          product.createListing({
            site: site.title,
            url: item.url,
            price: item.price,
          });
        }

        await product.save();

        return product;
      }
      return product;
    });
  });
};

export const newEggFetcher = async options => {
  const { url } = options;

  const crawler = new NewEggCrawler();
  const res = await crawler.crawlUrl(url);

  const updates = handleCrawledItems(res, options);

  return Promise.all(updates);
};

export const hsnFetcher = async options => {
  const { url } = options;

  const crawler = new HSNCrawler();
  const res = await crawler.crawlUrl(url);

  const updates = handleCrawledItems(res, options);

  return Promise.all(updates);
};

export const psFetcher = async options => {
  const { url } = options;

  const psCrawler = new ProshopCrawler();
  const res = await psCrawler.crawlUrl(url);

  const updates = handleCrawledItems(res, options);

  return Promise.all(updates);
};

const buildTree = async category => {
  const trail = [];
  const allCategories = await Category.findAll({
    include: [
      {
        model: Category,
        as: 'children',
        include: [
          {
            model: Product,
            as: 'products',
            include: [
              {
                model: Filter,
                as: 'filters',
              },
            ],
          },
        ],
      },
    ],
  });
  const buildTrail = categoryItem => {
    const category = allCategories.find(item => item.id === categoryItem.id);

    trail.push(category.id);

    if (!category.children || !category.children.length) {
      return;
    }

    category.children.forEach(item => {
      buildTrail(item);
    });
  };

  buildTrail(category);
  // const buildTrail = categoryId => {
  //   const category = allCategories.find(item => item.id === categoryId);

  //   trail.unshift(category.id);

  //   if (!category.parent) {
  //     return;
  //   }

  //   buildTrail(category.parent);
  // };

  // buildTrail(category.id);

  return trail;
};

const getProductsForCategoryTree = async category => {
  const childIds = await buildTree(category);

  const products = await Category.findAll({
    where: {
      id: {
        [Op.in]: childIds,
      },
    },
    include: [
      {
        model: Product,
        as: 'products',
        include: [
          {
            model: Filter,
            as: 'filters',
          },
        ],
      },
    ],
  }).then(categories => {
    const items = categories.reduce((acc, category) => {
      acc = acc.concat(category.products);

      return acc;
    }, []);

    return items;
  });

  return products;
};

const resolvers = {
  Query: {
    allProductsCursor: async (_, { after, first, categoryIds, filters }) => {
      const query = {
        include: [
          {
            model: Product,
            as: 'products',
            include: [
              {
                model: Filter,
                as: 'filters',
              },
            ],
          },
        ],
      };

      if (categoryIds) {
        query.where = {
          id: {
            [Op.in]: categoryIds,
          },
        };
      }

      const _allProducts = await Category.findAll(query)
        .then(categories => {
          const items = categories.reduce((acc, category) => {
            acc = acc.concat(category.products);

            return acc;
          }, []);

          return items;
        })
        .filter(item => item.main === 0);

      // const filters = [{ key: 'Brand', values: ['Intel'] }];
      const products =
        filters && filters.length
          ? filterProductsByFilter(filters, _allProducts)
          : _allProducts;
      // const products = _allProducts
      //   ? filterProductsByFilter(filters, _allProducts)
      //   : [];

      const totalCount = products.length;
      let items = [];
      let start = 0;

      if (after !== undefined) {
        // const buff = new Buffer(after, 'base64');
        // const id = buff.toString('ascii');
        // console.log('id', after);
        const index = products.findIndex(item => item.id === +after);
        if (index === -1) {
          throw new Error('After does not exist');
        }
        start = index + 1;
      }

      items =
        first === undefined ? products : products.slice(start, start + first);

      let endCursor;
      const edges = items.map(item => {
        // const buffer = new Buffer(item.id);
        // endCursor = buffer.toString('base64');
        endCursor = item.id.toString();
        return {
          cursor: endCursor,
          node: item,
        };
      });

      const hasNextPage = start + first < totalCount;
      const pageInfo =
        endCursor !== undefined
          ? {
              endCursor,
              hasNextPage,
            }
          : {
              hasNextPage,
            };

      return {
        edges,
        pageInfo,
        totalCount,
      };
    },
    author(_, args) {
      return Author.find({ where: args });
    },
    site(_, args) {
      return Site.find({ where: args });
    },
    allAuthors() {
      return Author.findAll();
    },
    async allProducts(_, args) {
      const query = {};
      const where = {
        main: 0,
      };

      if (args.limit) {
        query.limit = args.limit;
      }

      query.include = [
        {
          model: Filter,
          as: 'filters',
        },
      ];

      if (args.filter) {
        const { filter } = args;
        // const where = {};

        if (filter.title) {
          where.title = filter.title;
        } else if (filter.title_contains) {
          where.title = {
            [Op.like]: `%${filter.title_contains}%`,
          };
        }

        if (Object.keys(where).length > 0) {
          query.where = where;
        }

        return Product.findAll(query);
      }
      if (Object.keys(where).length > 0) {
        query.where = where;
      }
      return Product.findAll(query);
    },
    async filter(_, args) {
      const filter = await Filter.findOne({
        id: args.id,
      });

      return filter;
    },
    product(_, args) {
      return Product.find({ where: args });
    },
    allFilters(_, args) {
      return Filter.findAll();
    },
    async allCategories(_, args) {
      if (args.filter) {
        const { filter } = args;
        const query = {
          where: {},
          include: [
            {
              model: Category,
              as: 'children',
            },
          ],
        };
        const where = {};

        if (typeof filter.root !== 'undefined') {
          where.root = filter.root;
        }

        if (typeof filter.limit !== 'undefined') {
          query.limit = filter.limit;
        }

        query.where = where;

        if (Object.keys(where).length !== 0 || query.limit) {
          return Category.findAll(query);
        }
      }

      return Category.findAll({
        include: [
          {
            model: Product,
            as: 'products',
          },
          {
            model: Category,
            as: 'children',
          },
        ],
      });
    },
    fetcher(_, { id }) {
      return Fetcher.findById(id);
    },
    async category(_, args) {
      const where = Object.keys(args).reduce((acc, arg) => {
        if (['id'].indexOf(arg) > -1) {
          acc[arg] = args[arg];
        }

        return acc;
      }, {});

      const category = await Category.find({
        where,
        include: [
          {
            model: Product,
            as: 'products',
            include: [
              {
                model: Filter,
                as: 'filters',
              },
            ],
          },
          {
            model: Category,
            as: 'children',
          },
        ],
      });

      category.filters =
        category && category.products
          ? getUniqueFilters(category.products)
          : [];

      return category;
    },
    allFetchers() {
      return Fetcher.findAll({
        include: [
          {
            model: Site,
            as: 'site',
          },
        ],
      });
    },
    allSites() {
      return Site.findAll();
    },
    allListings() {
      return Listing.findAll();
    },
    listing(_, args) {
      return Listing.find({ where: args });
    },
  },
  Mutation: {
    fetchFilters: async (root, args) => {
      const listing = await Listing.findById(args.listingId, {
        include: [{ model: Product, as: 'product' }],
      });

      if (!listing) {
        throw new Error('No Listing with that ID found.');
      }

      let crawler;
      if (listing.site === 'NewEgg') {
        crawler = new NewEggCrawler();
      } else if (listing.site === 'Proshop') {
        crawler = new ProshopCrawler();
      } else if (listing.site === 'HSN') {
        crawler = new HSNCrawler();
      } else {
        throw new Error('Unable to find crawler for site.');
      }

      if (typeof crawler.crawlProduct !== 'function') {
        throw new Error(
          'Method crawlProduct is not set in this sites crawler.'
        );
      }

      const res = await crawler.crawlProduct(listing.url);

      const filters = await Promise.all(
        ((res && res.properties) || []).map(item => {
          return Filter.create(item).then(item => {
            return item.id;
          });
        })
      );

      const product = await Product.findById(listing.product.id);

      await product.setFilters(filters);

      await product.save();

      return Product.findById(listing.product.id);
    },
    addFetcher: async (root, args) => {
      // if pageNumberscan is true it will take an url and look
      // for $pageNumber and try to increment it until no more pages exists
      if (args.pageNumberScan) {
        // example url:
        // https://www.page.com/Product/ProductList.asp?page=$pageNumber&Category=228&PageSize=36
        if (!args.url || !args.url.includes('$pageNumber')) {
          throw new Error('$pageNumber is missing in url');
        }

        const site = await Site.findById(args.siteId);
        if (!site) {
          throw new Error(`No crawler for site with id: ${args.siteId}`);
        }

        let crawler;
        // TODO: should not use title here, add crawlerId or similar to site model
        if (site.title === 'Proshop') {
          crawler = new ProshopCrawler();
        } else if (site.title === 'NewEgg') {
          crawler = new NewEggCrawler();
        } else if (listing.site === 'HSN') {
          crawler = new HSNCrawler();
        }

        if (typeof crawler === 'undefined') {
          throw new Error(`No crawler for site with id: ${args.siteId}`);
        }

        const res = await crawler.crawlNextPages([], 1, args.url);

        if (!res || (res && !res.length)) {
          return null;
        }

        const filteredResults = (res || []).filter(item => {
          if (!item || !item.url) {
            return false;
          }
          return true;
        });

        return Fetcher.bulkCreate(filteredResults, {
          individualHooks: true,
        })
          .then(created => {
            const promises = created.map(item => {
              item.setSite(args.siteId);
              item.setCategory(args.categoryId);

              return item.save();
            });

            return Promise.all(promises);
          })
          .then(() => {
            return Fetcher.findAll();
          });
      }

      const fetcher = await Fetcher.build({
        url: args.url,
      });

      await fetcher.setSite(args.siteId);

      if (args.categoryId) {
        const category = await Category.findOne({
          where: { id: args.categoryId },
        });

        if (category) {
          await fetcher.setCategory(category);
        }
      }

      return fetcher.save();
    },
    combine: async (root, { productIds, mainId }) => {
      const productsToUpdate = productIds.map(id => {
        return Product.findById(id).then(product => {
          product.update({ main: mainId });
          return product.save();
        });
      });

      return Promise.all(productsToUpdate);
    },
    split: async (root, { productId }) => {
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('Unable to find product.');
      }

      product.main = 0;

      return product.save();
    },
    runSiteMapCrawler: async (root, { siteId }) => {
      // const item = await Category.findOrBuild({
      //   where: {
      //     title: 'Cameras',
      //   },
      //   defaults: {
      //     title: 'Cameras',
      //     root: false,
      //   },
      // });

      // console.log('item', item);

      // return null;
      const crawler = new NewEggCrawler();
      const res = await crawler.crawlSitemap(
        'https://www.newegg.com/Info/SiteMap.aspx'
      );

      const items = res
        .map(item => ({
          title: item.title,
          url: item.url,
          root: true,
          children: item.children,
        }))
        .filter(item => item.title && item.title.length > 0);

      const _items = await Promise.all(
        items.map(item => {
          return Category.findOrBuild({
            where: { title: item.title },
            defaults: { root: true, title: item.title },
          }).then(([category, created]) => {
            return category.save().then(async category => {
              if (item.url && siteId && category.id && created) {
                const fetcher = Fetcher.build({
                  url: item.url,
                });

                await fetcher.setSite(siteId);
                await fetcher.setCategory(category);

                await fetcher.save();
              }

              if (item.children && item.children.length) {
                const children = item.children.map(child => {
                  return Category.findOrBuild({
                    where: {
                      title: child.title,
                    },
                    defaults: {
                      title: child.title,
                      parent: category.id,
                      root: false,
                    },
                  }).then(([createdChild, created]) => {
                    return createdChild.save().then(async createdChild => {
                      if (created) {
                        const fetcher = Fetcher.build({
                          url: child.url,
                        });

                        await fetcher.setSite(siteId);
                        await fetcher.setCategory(createdChild);

                        return fetcher.save().then(() => {
                          return createdChild;
                        });
                      }
                      return createdChild;
                    });
                  });
                });

                return Promise.all(children).then(() => {
                  return category;
                });
              }

              return category;
            });
          });
        })
      );

      return null;

      // const items = [
      //   { title: 'hej', root: true },
      //   { title: 'hej2', root: true },
      // ];
      const created = await Category.bulkCreate(items, {
        // fields: ['title', 'root'],
        individualHooks: true,
        // validate: true,
        // updateOnDuplicate: ['title', 'root'],
      });
      // .then(created => {
      //   const promises = created.map((item, index) => {
      //     // if (res[index]) {
      //     // const url = res[index].url;
      //     // console.log('item', item.id, item.title);
      //     // const fetcher = Fetcher.build({
      //     //   url: 'http://testsite.com',
      //     // });
      //     // fetcher.setSite(siteId);
      //     // fetcher.setCategory(item.id);
      //     // return fetcher.save();
      //     // return Promise.resolve();
      //     // }
      //     // return Promise.resolve(null);
      //     return Promise.resolve();
      //   });

      //   return Promise.all(promises).then(() => created);
      // });

      // console.log('created', created);

      return null;

      const promises = res.map(item => {
        // return Category.findOrCreate({
        //   where: {
        //     title: item.title,
        //   },
        //   defaults: {
        //     title: item.title,
        //     root: true,
        //   },
        // }).then(async ([category, created]) => {
        return Category.create({
          title: item.title,
          root: true,
        }).then(async category => {
          if (item.url && siteId && category.id) {
            const fetcher = Fetcher.build({
              url: item.url,
            });

            await fetcher.setSite(siteId);
            await fetcher.setCategory(category);

            await fetcher.save();
          }

          if (item.children && item.children.length) {
            const children = item.children.map(child => {
              return Category.findOrCreate({
                where: {
                  title: child.title,
                },
                defaults: {
                  title: child.title,
                  parent: category.id,
                  root: false,
                },
              }).then(async ([createdChild, created]) => {
                // return Category.create({
                //   title: child.title,
                //   parent: category.id,
                //   root: false,
                // }).then(async createdChild => {
                const fetcher = Fetcher.build({
                  url: child.url,
                });

                await fetcher.setSite(siteId);
                await fetcher.setCategory(createdChild);

                return fetcher.save();
              });
            });

            return Promise.all(children);
          }
          return Promise.all([]);
        });
      });

      await Promise.all(promises);

      return res;
    },
    runFetcher: async (root, { fetcherId }) => {
      const fetcher = await Fetcher.findById(fetcherId, {
        include: [{ model: Site, as: 'site' }],
      });

      let res = null;
      if (fetcher.site.title === 'Proshop') {
        res = await psFetcher({
          url: fetcher.url,
          site: fetcher.site,
          categoryId: fetcher.categoryId,
        });
      } else if (fetcher.site.title === 'NewEgg') {
        res = await newEggFetcher({
          url: fetcher.url,
          site: fetcher.site,
          categoryId: fetcher.categoryId,
        });
      } else if (fetcher.site.title === 'HSN') {
        res = await hsnFetcher({
          url: fetcher.url,
          site: fetcher.site,
          categoryId: fetcher.categoryId,
        });
      }

      if (res) {
        fetcher.lastFetched = new Date().getTime();
        await fetcher.save();
      }

      return res;
    },
    runFetchers: async (root, args) => {
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

      const data = await Promise.all(promises);
      return data[0];
    },

    scanPage: async (root, args) => {
      const { site, url } = args;

      const categoryId = 1; // TODO: should not be static

      return psFetcher({ url, site, categoryId });
    },
    addFilter: async (root, args) => {
      const filter = await Filter.create({
        key: args.key,
        values: args.filterValues,
      });

      return filter;
    },
    addProduct: async (root, args) => {
      const product = await Product.create({ title: args.title });

      if (args.categoryId) {
        await product.setCategory(args.categoryId);
      }

      if (args.filters) {
        const promises = args.filters.map(async item => {
          const filter = await Filter.create({
            key: item.key,
            values: item.values,
          });

          return filter;
        });

        const filters = await Promise.all(promises);
        await product.setFilters(filters);
      }

      return product;
    },
    addCategory: (root, args) => {
      return Category.create({
        title: args.title,
        parent: args.parentId,
        root: args.parentId ? false : true,
      });
    },
    updateCategory: async (root, args) => {
      const category = await Category.findById(args.id);

      if (!category) {
        return null;
      }

      if (args.parentId) {
        const parent = await Category.findById(args.parentId);

        if (!parent) {
          throw new Error(
            'Unable to find parent category with id ' + args.parentId
          );
        }
      }

      category.update({
        title: args.title || category.title,
        parent: args.parentId || null,
        root: args.parentId ? false : true,
      });

      return category.save();
    },
    updateSite: async (root, args) => {
      const site = await Site.findById(args.id);

      if (!site) {
        return null;
      }

      site.update({
        title: args.title || site.title,
        url: args.url || site.url,
      });

      return site.save();
    },
    updateFetcher: async (root, args) => {
      const fetcher = await Fetcher.findById(args.id);

      if (!fetcher) {
        return null;
      }

      if (args.siteId) {
        await fetcher.setSite(args.siteId);
      }

      fetcher.update({
        // site: args.site || fetcher.site,
        url: args.url || fetcher.url,
      });

      if (args.categoryId) {
        await fetcher.setCategory(args.categoryId);
      }

      return fetcher.save();
    },
    updateFilter: async (root, { id, key, values }) => {
      const filter = await Filter.findById(id);

      if (!filter) {
        return null;
      }

      filter.update({
        key: key || filter.key,
        values: values || filter.values,
      });

      return filter.save();
    },
    deleteCategory: async (root, args) => {
      const category = await Category.findById(args.id);

      if (!category) {
        return null;
      }
      return category.destroy();
    },
    deleteSite: async (root, args) => {
      const site = await Site.findById(args.id);

      if (!site) {
        return null;
      }
      return site.destroy();
    },
    deleteFilter: async (root, { id }) => {
      const filter = await Filter.findById(id);

      if (!filter) {
        return null;
      }
      return filter.destroy();
    },
    deleteFetcher: async (root, args) => {
      const fetcher = await Fetcher.findById(args.id);

      if (!fetcher) {
        return null;
      }
      return fetcher.destroy();
    },
    updateProduct: async (root, args) => {
      const product = await Product.findById(args.id);

      if (!product) {
        return null;
      }

      if (args.filters) {
        const filters = await Promise.all(
          args.filters.map(item => {
            return Filter.create({
              key: item.key,
              values: item.values,
            });
          })
        );

        const filterIds = filters.map(filter => filter.id);
        await product.setFilters(filterIds);
      }

      if (args.categoryId) {
        await product.setCategory(args.categoryId);
      }

      product.update({
        title: args.title || product.title,
      });

      return product.save();
    },
    deleteProduct: async (root, args) => {
      const product = await Product.findById(args.id);

      if (!product) {
        return null;
      }
      return product.destroy();
    },
    refreshListing: async (root, args) => {
      const listings = await Listing.findAll({
        where: {
          id: {
            [Op.in]: args.listingIds,
          },
        },
      });

      // const urls = listings.map(listing => [
      //   listing.id,
      //   listing.url,
      //   listing.site,
      // ]);

      // const crawler = new Crawler();
      // const res = await crawler.crawl({ urls });

      // const updates = res.map(resItem => {
      //   const listing = listings.find(item => resItem.id === item.id);

      //   if (listing && resItem.price) {
      //     listing.update({ price: resItem.price });
      //     return listing.save();
      //   }

      //   return listing.save();
      // });

      // await Promise.all(updates);

      return listings;
    },
    addListing: async (root, args) => {
      if (args.productId) {
        const product = await Product.find({ where: { id: args.productId } });

        return product.createListing({
          url: args.url,
          site: args.site,
          price: args.price,
        });
      }
      return Listing.create({
        site: args.site,
        url: args.url,
        price: args.price,
      });
    },
    addSite: async (root, args) => {
      return Site.create({
        title: args.title,
        url: args.url,
      });
    },
  },
  Site: {
    fetchers(site, args) {
      return site.getFetchers();
    },
  },
  Category: {
    async trail(category) {
      return await buildTree(category);
    },
    async products(category, args) {
      const items = await getProductsForCategoryTree(category);
      return items.filter(item => item.main === 0);
    },
    fetchers(category) {
      return category.getFetchers();
    },
  },
  Product: {
    filters(product) {
      return product.getFilters();
    },
    async variations(product) {
      const query = {};
      if (product.main === 0) {
        query.where = {
          main: product.id,
        };
      } else {
        query.where = {
          [Op.or]: [{ main: product.main }, { id: product.main }],
        };
      }
      return Product.findAll(query);
    },
    async listings(product) {
      const mainId = product.main === 0 ? product.id : product.main;
      const listings = await Product.findAll({
        where: {
          [Op.or]: [{ main: mainId }, { id: mainId }],
        },
        include: {
          model: Listing,
          as: 'listings',
        },
      }).then(items => {
        const listings = items.reduce((acc, product) => {
          acc = acc.concat(product.listings);
          return acc;
        }, []);

        return listings;
      });
      return listings;
    },
    category(product) {
      return product.getCategory();
    },
    async cheapestListing(product) {
      const mainId = product.main === 0 ? product.id : product.main;
      const listings = await Product.findAll({
        where: {
          [Op.or]: [{ main: mainId }, { id: mainId }],
        },
        include: {
          model: Listing,
          as: 'listings',
        },
      }).then(items => {
        const listings = items.reduce((acc, product) => {
          acc = acc.concat(product.listings);
          return acc;
        }, []);

        return listings;
      });

      if (listings && listings.length) {
        return listings.reduce((acc, listing) => {
          if (!acc) {
            acc = listing;
            return acc;
          }

          if (listing.price < acc.price) {
            acc = listing;
          }
          return acc;
        }, null);
      }
      return null;
    },
  },
  Author: {
    posts(author) {
      return author.getPosts();
    },
  },
  Listing: {
    product(listing) {
      return listing.getProduct();
    },
  },
  Fetcher: {
    category(fetcher) {
      return fetcher.getCategory();
    },
    site(fetcher) {
      return fetcher.getSite();
    },
  },
  Post: {
    author(post) {
      return post.getAuthor();
    },
    views(post) {
      return View.findOne({ postId: post.id }).then(view => view.views);
    },
  },
};

export default resolvers;
