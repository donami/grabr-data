# Docs

## Crawler Mutations:

### Crawler: Add attributes to product

```
mutation {
  fetchFilters(listingId: 1) {
    id
  }
}
```

Will crawl url for the listing url and add filters (if found) to the product.

### Crawler: Run all fetchers

```
mutation {
  runFetchers {
    id
  }
}
```

### Crawler: Add fetcher

```
addFetcher(url: String!, siteId: Int!, categoryId: Int, pageNumberScan: Boolean): Fetcher
```

If pageNumberScan is `true`, it will add a fetcher for all pages using a placeholder `$pageNumber`.
It will parse urls starting with `pageNumber` 1 and crawl pages by incrementing the `pageNumber` by one until it reaches a page with no products.

```
mutation {
  addFetcher(url: "http://page.com/?category=phones&page=$pageNumber", siteId: 1, categoryId: 1, pageNumberScan: true): {
    id
  }
}
```

If `pageNumberScan` is `false`. It will simply add the url to fetch.

```
mutation {
  addFetcher(url: "http://page.com/?category=phones", siteId: 1, categoryId: 1): {
    id
  }
}
```
