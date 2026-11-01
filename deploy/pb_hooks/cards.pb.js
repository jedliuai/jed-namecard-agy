/// <reference path="../pb_data/types.d.ts" />

// Card link names become subdomains (slug.1name.cards), so the ones the service itself needs are kept back.

onRecordCreateRequest((e) => {
  require(`${__hooks}/_cards_lib.js`).checkSlug(e);
  return e.next();
}, "cards");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/_cards_lib.js`).checkSlug(e);
  return e.next();
}, "cards");
