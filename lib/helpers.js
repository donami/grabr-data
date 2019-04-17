export const getUniqueFilters = products => {
  const filters = products.reduce((acc, product) => {
    product.filters.forEach(filter => {
      const existingIndex = acc.findIndex(item => item.key === filter.key);
      if (existingIndex > -1) {
        acc[existingIndex] = Object.assign({}, acc[existingIndex], {
          values: acc[existingIndex].values.concat(filter.values.split(', ')),
        });
      } else {
        acc.push({
          key: filter.key,
          values: filter.values.split(', '),
        });
      }
    });

    return acc;
  }, []);

  return filters;
};

export const filterProductsByFilter = (filters, products) => {
  if (filters.length === 0) {
    return products;
  }

  const items = (products || []).filter(product => {
    let pass = true;
    filters.forEach(filter => {
      // if product has specified filter
      const exists = product.filters.find(item => item.key === filter.key);

      if (!exists) {
        pass = false;
      } else {
        const values = exists.values.split(',').map(value => value.trim());
        const hasValue = filter.values.reduce((acc, value) => {
          if (values.indexOf(value) > -1) {
            return true;
          }
          return acc;
        }, false);

        if (hasValue === false) {
          pass = false;
        }
      }
    });

    return pass;
  });

  return items;
};
