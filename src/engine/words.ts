import Decimal from 'decimal.js';

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitsToWords(n: number): string {
  if (n < 20) {
    return ONES[n];
  }
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one ? ' ' + ONES[one] : '');
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  const hundredPart = hundred ? ONES[hundred] + ' Hundred' : '';
  const remainderPart = remainder ? (hundred ? ' and ' : '') + twoDigitsToWords(remainder) : '';
  return (hundredPart + remainderPart).trim();
}

function integerToIndianWords(num: number): string {
  if (num === 0) return 'Zero';

  let n = num;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  let result = '';

  if (crore > 0) {
    result += twoDigitsToWords(crore) + ' Crore ';
  }
  if (lakh > 0) {
    result += twoDigitsToWords(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    result += twoDigitsToWords(thousand) + ' Thousand ';
  }
  if (n > 0) {
    result += threeDigitsToWords(n);
  }

  return result.trim().replace(/\s+/g, ' ');
}

/**
 * Converts a currency amount to Indian currency words format.
 * Examples:
 * 96108.00 -> "Ninety Six Thousand One Hundred and Eight Rupees Only"
 * 96108.36 -> "Ninety Six Thousand One Hundred and Eight Rupees and Thirty Six Paise Only"
 */
export function amountToIndianWords(amount: number | string | Decimal): string {
  const dec = new Decimal(amount || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (dec.isZero()) {
    return 'Zero Rupees Only';
  }

  const isNegative = dec.isNegative();
  const absDec = dec.abs();

  const rupees = absDec.floor().toNumber();
  const paise = absDec.minus(rupees).times(100).round().toNumber();

  let result = '';

  if (rupees > 0) {
    const rupeesText = integerToIndianWords(rupees);
    result += rupeesText + (rupees === 1 ? ' Rupee' : ' Rupees');
    if (paise > 0) {
      const paiseText = twoDigitsToWords(paise);
      const paiseUnit = paise === 1 ? 'Paisa' : 'Paise';
      result += ' and ' + paiseText + ' ' + paiseUnit;
    }
  } else if (paise > 0) {
    const paiseText = twoDigitsToWords(paise);
    const paiseUnit = paise === 1 ? 'Paisa' : 'Paise';
    result += paiseText + ' ' + paiseUnit;
  }

  result += ' Only';

  return isNegative ? 'Minus ' + result : result;
}
