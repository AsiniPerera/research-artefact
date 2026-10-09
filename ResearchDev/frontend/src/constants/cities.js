/* Cities offered by the City filter on the Explore page.

   Each must match raw.provider.city exactly, ignoring case: the ranking API
   filters on lower(trim(city)), so a spelling variant stored in the data
   (e.g. "pannipitya") is not caught by its city here. Such providers still
   appear under "All cities". */
export const CITIES = [
  "Angoda",
  "Battaramulla",
  "Boralesgamuwa",
  "Colombo",
  "Dehiwala-Mount Lavinia",
  "Hokandara",
  "Homagama",
  "Kaduwela",
  "Kolonnawa",
  "Maharagama",
  "Malabe",
  "Nugegoda",
  "Pannipitiya",
  "Piliyandala",
  "Ruhunupura",
  "Sri Jayawardenepura Kotte",
  "Welivita",
];
