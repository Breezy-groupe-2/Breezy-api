const MAX_LIMIT = 100;

const applyCursorPagination = async (model, { cursor, limit = 20, sort = { createdAt: -1 }, filter = {} } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
  const query = { ...filter };

  if (cursor) {
    const direction = sort.createdAt === -1 ? '$lt' : '$gt';
    query._id = { [direction]: cursor };
  }

  const items = await model.find(query).sort(sort).limit(safeLimit + 1);
  const hasMore = items.length > safeLimit;
  const data = hasMore ? items.slice(0, safeLimit) : items;
  const nextCursor = hasMore ? data[data.length - 1]._id.toString() : null;

  return { data, nextCursor, hasMore };
};

module.exports = { applyCursorPagination };
