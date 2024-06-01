import moment from 'moment';

moment.locale('es');

// Define the format string considering the order of the date parts
const formatString = 'dddd DD MMMM, YYYY HH:mm';

// Parse the date string
const parsedDate = moment(
  "Viernes 24 Mayo, 2024 19:54", formatString
);

// Check if parsing was successful
if (parsedDate.isValid()) {
  console.log("Parsed Date:", parsedDate.format());
} else {
  console.error("Failed to parse date!");
}