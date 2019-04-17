import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
// import mocks from './mocks';
import resolvers from './resolvers';

const typeDefs = `
type Author {
  id: Int
  firstName: String
  lastName: String
  posts: [Post]
}
type Post {
  id: Int
  title: String
  text: String
  views: Int
  author: Author
}
type UniqueFilter {
  key: String
  values: [String]
}
type Product {
  id: Int
  image: String
  title: String
  main: Int
  listings: [Listing]
  category: Category
  cheapestListing: Listing
  filters: [Filter]
  createdAt: String
  variations: [Product]
}
type Edge {
  cursor: String!
  node: Product!
}
type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
}
type ProductResultCursor {
  edges: [Edge]!
  pageInfo: PageInfo!
  totalCount: Int!
}
type Category {
  id: Int
  title: String
  root: Boolean
  children: [Category]
  parent: Int
  products(categoryFilter: [UniqueFilterInput]): [Product]
  fetchers: [Fetcher]
  filters: [UniqueFilter]
  trail: [Int]
}
type Listing {
  id: Int
  url: String
  site: String!
  price: Float
  product: Product
}
type Fetcher {
  id: Int
  url: String!
  site: Site
  category: Category
  lastFetched: String
}

type FilterKey {
  id: Int!
  key: String!
}

type Filter {
  id: Int!
  key: String!
  values: String
}

type Site {
  id: Int!
  title: String!
  url: String!
  fetchers: [Fetcher]
}

type SiteMapResult {
  title: String
  url: String
  children: [SiteMapResult]
}

input ProductFilter {
  title: String
  title_contains: String
}

input CategoryFilter {
  root: Boolean
  limit: Int
}

input AddProductFilters {
  key: String!
  values: String
}

input UniqueFilterInput {
  key: String!
  values: [String]
}

type Query {
  allProductsCursor(
    categoryIds: [Int], 
    after: String, 
    first: Int,
    filters: [UniqueFilterInput]
  ): ProductResultCursor
  allFilters: [Filter]
  allSites: [Site]
  author(firstName: String, lastName: String): Author
  allAuthors: [Author]
  product(id: Int!): Product
  site(id: Int!): Site
  fetcher(id: Int!): Fetcher
  allProducts(filter: ProductFilter): [Product]
  category(id: Int!): Category
  filter(id: Int!): Filter
  allCategories(filter: CategoryFilter): [Category]
  listing(id: Int!): Listing
  allListings: [Listing]
  allFetchers: [Fetcher]
  getFortuneCookie: String @cacheControl(maxAge: 240)
}

type Mutation {
  runFetchers: [Product]
  runFetcher(fetcherId: Int): [Product]
  runSiteMapCrawler(siteId: Int): [SiteMapResult]
  scanPage(site: String!, url: String!): [Product]
  addProduct(
    title: String!
    filters: [AddProductFilters]
    categoryId: Int
  ): Product
  addCategory(title: String!, parentId: Int): Category
  deleteCategory(id: Int!): Category
  deleteProduct(id: Int!): Product
  deleteFetcher(id: Int!): Fetcher
  deleteSite(id: Int!): Site
  deleteFilter(id: Int!): Filter
  fetchFilters(listingId: Int!): Product
  updateProduct(id: Int!, title: String, filters: [AddProductFilters], categoryId: Int): Product
  updateSite(id: Int!, title: String, url: String): Site
  updateCategory(id: Int!, title: String, parentId: Int): Category
  updateFetcher(id: Int!, url: String, siteId: Int!, categoryId: Int): Fetcher
  updateFilter(id: Int!, key: String, values: String): Filter
  addFetcher(url: String!, siteId: Int!, categoryId: Int, pageNumberScan: Boolean): Fetcher
  addSite(title: String!, url: String!): Site
  addListing(url: String!, price: Int!, site: String!, productId: Int): Listing
  addFilter(key: String!, filterValues: String): Filter
  refreshListing(listingIds: [Int]!): [Listing]
  combine(productIds: [Int]!, mainId: Int!): [Product]
  split(productId: Int!): Product
}
`;

// addFilterValue(value: String!): FilterValue
// addFilterKey(key: String!): FilterKey

const schema = makeExecutableSchema({ typeDefs, resolvers });

// addMockFunctionsToSchema({ schema, mocks });

export default schema;
