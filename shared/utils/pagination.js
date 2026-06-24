const applyCursorPagination = async (model, { cursor, limit = 20, sort = { createdAt: -1 }, filter = {} } = {}) => {
  const query = { ...filter };

  if (cursor) {
    const direction = sort.createdAt === -1 ? '$lt' : '$gt';
    query._id = { [direction]: cursor };
  }

  const items = await model.find(query).sort(sort).limit(limit + 1);
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]._id.toString() : null;

  return { data, nextCursor, hasMore };
};

module.exports = { applyCursorPagination };
