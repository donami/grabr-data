// import CrawlerInternal from 'crawler';
// import puppeteer from 'puppeteer';
// import cheerio from 'cheerio';

// export class NewEggCrawler {
//   constructor() {
//     this.service = new CrawlerInternal({ maxConnections: 10 });
//   }

//   formatPrice(price) {
//     const output = price.replace(',', '');

//     return +output;
//   }

//   getPageNumberEvaluator() {
//     return () =>
//       document.querySelectorAll('.list-tool-search').length > 0 &&
//       document.querySelectorAll('.item-container').length > 0;
//   }

//   async crawlSiteMap(url) {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: 'networkidle2' });

//     const attributes = await page.evaluate(() => {
//       const elems = document.querySelectorAll(
//         '#siteMap .cat, #siteMap .subCat, #siteMap ul'
//       );

//       let lastChildIndex = 0;
//       const data = Array.from(elems)
//         .reduce((acc, elem) => {
//           if (elem.classList.contains('cat')) {
//             const anchorElem = elem.querySelector('a');
//             const href = anchorElem ? anchorElem.getAttribute('href') : '';
//             const title = anchorElem ? anchorElem.getAttribute('title') : '';

//             lastChildIndex = 0;
//             acc.push({
//               title: title,
//               url: href,
//               children: [],
//             });
//           } else if (elem.classList.contains('subCat')) {
//             if (elem.innerText.length) {
//               const anchorElem = elem.querySelector('a');
//               const href = anchorElem ? anchorElem.getAttribute('href') : null;
//               const title = anchorElem
//                 ? anchorElem.getAttribute('title')
//                 : null;

//               if (href) {
//                 acc[acc.length - 1].children.push({
//                   title: title,
//                   url: href,
//                   children: [],
//                 });
//                 lastChildIndex++;
//               }
//             }
//           } else {
//             // const items = elem.querySelectorAll('li');
//             // const children = Array.from(items).map(item => {
//             //   return {
//             //     title: item.innerText,
//             //     children: [],
//             //   };
//             // });
//             // const lastChild = acc[acc.length - 1].children[lastChildIndex];
//             // if (lastChild) {
//             //   lastChild.children = children;
//             // }
//           }
//           return acc;
//         }, [])
//         .filter(
//           item =>
//             !!item.title.length &&
//             [
//               'Daily Deal',
//               'Shop All Categories',
//               'Shop all Brands',
//               "What's New",
//               'Free Shipping',
//               'Combo Deals',
//               'Refurbished Items',
//               'Open Box',
//               'Volume Savings',
//               'Rebate Center',
//               'Clearance Center',
//               'Items With Gifts',
//               'Newegg Student Store',
//               'Newegg Subscription',
//               'EggPoints Eligible',
//               'Help & Info',
//             ]
//               .map(title => title.toLowerCase())
//               .indexOf(item.title.toLowerCase()) === -1
//         );

//       return data;
//     });

//     await browser.close();

//     return attributes;
//   }

//   async crawlProduct(url) {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: 'networkidle2' });

//     const attributes = await page.evaluate(() => {
//       const elems = document.querySelectorAll('#detailSpecContent dl');

//       const data = [];
//       elems.forEach(elem => {
//         data.push({
//           key: elem.querySelector('dt').textContent,
//           values: elem.querySelector('dd').textContent,
//         });
//       });

//       return data;
//     });

//     await browser.close();

//     return attributes;
//   }

//   crawl(url) {
//     return new Promise((resolve, reject) => {
//       // return resolve([]);
//       return this.service.queue([
//         {
//           uri: url,
//           // https://www.newegg.com/CPUs-Processors/Category/ID-34
//           callback: (error, res, done) => {
//             if (error) {
//               console.log(error);
//               done();
//               // return innerReject(error);
//             } else {
//               const { $ } = res;

//               const items = [];

//               $('.items-view .item-container').each((i, elem) => {
//                 const url = $(elem)
//                   .find('a.item-img')
//                   .attr('href');

//                 const title = $(elem)
//                   .find('.item-info .item-title')
//                   .text();
//                 const price = $(elem)
//                   .find('.price-current strong')
//                   .text();

//                 let image = $(elem)
//                   .find('.item-img > img')
//                   .attr('src');
//                 if (!image) {
//                   image = $(elem)
//                     .find('.lazy-img')
//                     .data('src');
//                 }

//                 const data = {
//                   title,
//                   price: this.formatPrice(price),
//                   image,
//                   url,
//                   image: `https://${image}`,
//                 };

//                 items.push(data);
//               });

//               done();
//               return resolve(items);
//             }
//           },
//         },
//       ]);
//     });
//   }
// }
// export class HSNCrawler {
//   /* Example url: https://www.hsn.com/shop/desktop-computers/ec0031 */
//   constructor() {
//     this.service = new CrawlerInternal({ maxConnections: 10 });
//   }

//   formatPrice(price) {
//     const output = price.replace(',', '');

//     return +output;
//   }

//   getPageNumberEvaluator() {
//     return () =>
//       document.querySelectorAll('.list-tool-search').length > 0 &&
//       document.querySelectorAll('.item-container').length > 0;
//   }

//   crawl(url) {
//     return new Promise((resolve, reject) => {
//       return this.service.queue([
//         {
//           uri: url,
//           callback: (error, res, done) => {
//             if (error) {
//               console.log(error);
//               done();
//               // return innerReject(error);
//             } else {
//               const { $ } = res;

//               const items = [];

//               $('.item.product-item').each((i, elem) => {
//                 const url = $(elem).data('product-url');
//                 const title = $(elem)
//                   .find('[itemprop=name]')
//                   .text();
//                 const price = $(elem)
//                   .find('[itemprop=price]')
//                   .text();
//                 const image = $(elem)
//                   .find('[itemprop=image]')
//                   .attr('src');
//                 const data = {
//                   title: title.trim().split('\r')[0],
//                   price,
//                   image,
//                   url: `https://www.hsn.com/${url}`,
//                 };

//                 if (data.title && data.price && data.image && data.url) {
//                   items.push(data);
//                 }
//               });

//               done();

//               return resolve(items);
//             }
//           },
//         },
//       ]);
//     });
//   }
// }

// export class ProshopCrawler {
//   constructor() {
//     this.service = new CrawlerInternal({ maxConnections: 10 });
//   }

//   getPageNumberEvaluator() {
//     return () =>
//       document.querySelectorAll('#productList .row.toggle').length > 0;
//   }

//   formatPrice(price) {
//     const output = price.split(',');

//     return +output[0];
//   }

//   crawl(url) {
//     return new Promise((resolve, reject) => {
//       return this.service.queue([
//         {
//           uri: url,
//           // uri: 'https://www.proshop.se/Baerbar',
//           callback: (error, res, done) => {
//             if (error) {
//               console.log(error);
//               done();
//               // return innerReject(error);
//             } else {
//               const { $ } = res;

//               const items = [];
//               $('#productList .row.toggle').each((i, elem) => {
//                 const url = $(elem)
//                   .find('a.site-product-link')
//                   .attr('href');
//                 const title = $(elem)
//                   .find('a.site-product-link h2')
//                   .text();
//                 const price = $(elem)
//                   .find('span.site-currency-lg')
//                   .text();
//                 const image = $(elem)
//                   .find('.text-center a img')
//                   .attr('src');

//                 const data = {
//                   title,
//                   price: this.formatPrice(price),
//                   image: `https://${image}`,
//                   url: `https://www.proshop.se${url}`,
//                 };

//                 items.push(data);
//               });

//               done();
//               return resolve(items);
//               // return innerResolve(data);
//             }
//           },
//         },
//       ]);
//     });
//   }
// }

// class Crawler {
//   constructor() {
//     this.service = new CrawlerInternal({
//       maxConnections: 10,
//     });
//   }

//   formatPrice(price) {
//     const output = price.split(',');

//     return +output[0];
//   }

//   getQueries(site, $) {
//     if (site === 'Proshop') {
//       let price = $('button.site-btn-addToBasket-lg').attr('data-price');

//       return {
//         price: this.formatPrice(price),
//       };
//     }

//     return {};
//   }

//   crawl(options) {
//     return new Promise((resolve, reject) => {
//       const promises = options.urls.map(([listingId, url, site]) => {
//         return new Promise((innerResolve, innerReject) => {
//           this.service.queue([
//             {
//               uri: url,
//               callback: (error, res, done) => {
//                 if (error) {
//                   done();
//                   return innerReject(error);
//                 } else {
//                   const { $ } = res;

//                   const data = Object.assign(
//                     {},
//                     { url, id: listingId },
//                     this.getQueries(site, $)
//                   );
//                   done();
//                   return innerResolve(data);
//                 }
//               },
//             },
//           ]);
//         });
//       });

//       return Promise.all(promises).then(data => {
//         return resolve(data);
//       });
//     });
//   }
// }

// export default Crawler;
