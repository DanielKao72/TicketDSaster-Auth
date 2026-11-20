const ROLES = Object.freeze({
  VENUE_OWNER: 'VENUE_OWNER',
  ORGANIZER: 'ORGANIZER',
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

module.exports = { ROLES, ROLE_VALUES };
