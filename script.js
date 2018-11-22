/* global crypto fetch TextEncoder */

const wordlistUrl = "https://cdn.jsdelivr.net/npm/word-list@2.0.0/words.txt";
const moMatchMsg = "No match. (Maybe try a different spelling?)";

function superficial_latin(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z ]/g,'');
}

// https://alpha.bi/
function naive_alphabi(s) {
  return s.replace(/ /g,'').replace(/./g, function(c) {
    return c < 'n' ? '0' : '1';
  });
}

const realName = document.getElementById('realname');
const thankedName = document.getElementById('thankedname');
const matchLine = document.getElementById('matchline');
const matchStat = document.getElementById('matchstat');
const matchOdds = document.getElementById('matchodds');
const matchBits = document.getElementById('matchbits');

const matchLineBaseClass = matchLine.className + ' ';
function setMatchClass(cn) {
  matchLine.className = matchLineBaseClass + 'match-' + cn;
}
setMatchClass('init');

const templateMatchBit =
  document.getElementById('matchbit').content.firstChild;
const templateListWord =
  document.getElementById('listword').content.firstChild;

const bitSpans = [];
for (let i = 0; i < 256; ++i) {
  matchBits.appendChild(bitSpans[i] = templateMatchBit.cloneNode());
}
let targetBits = null;

function byteToBits(byte) {
  return byte.toString(2).padStart(8, '0');
}

function bytesToBits(bytes) {
  return Array.from(new Uint8Array(bytes)).map(byteToBits).join('');
}

function getSha256Bits(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    .then(bytesToBits);
}

function setTarget(bits) {
  targetBits = bits;
  if (targetBits) {
    for (let i = 0; i < 256; ++i) {
      bitSpans[i].textContent = targetBits[i];
    }
    matchBits.hidden = false;
  } else {
    matchBits.hidden = true;
  }
  return updateMatch();
}

function setMatchStat(bitsMatching) {
  if (bitsMatching == 'init') {
    matchStat.textContent = 'Ready.';
    matchOdds.textContent = '';
    setMatchClass('init');
    for (let i = 0; i < 256; ++i) {
      bitSpans[i].classList.remove('lit');
    }
  } else {
    if (bitsMatching == 0) {
      matchStat.textContent = 'No match';
      matchOdds.textContent = '(spell name differently?)';
      setMatchClass('none');
    } else if (bitsMatching < 8) {
      matchStat.textContent = 'Ambiguous';
      setMatchClass('ambig');
    } else if (bitsMatching < 20) {
      matchStat.textContent = 'Likely';
      setMatchClass('likely');
    } else {
      matchStat.textContent = 'Match';
      setMatchClass('certain');
    }
    if (bitsMatching > 0) {
      matchOdds.textContent = `(${
        (Math.pow(2, bitsMatching) - 1).toLocaleString()}:1)`;
    }
    for (let i = 0; i < 256; ++i) {
      if (i < bitsMatching) {
        bitSpans[i].classList.add('lit');
      } else {
        bitSpans[i].classList.remove('lit');
      }
    }
  }
}

function updateTarget() {
  const targetName = superficial_latin(realName.value).trim();
  if (targetName) {
    return getSha256Bits(targetName).then(setTarget);
  } else {
    setTarget(null);
  }
}

function updateMatch() {
  const thank = superficial_latin(thankedName.value).trim();
  if (thank && targetBits) {
    const bitspec = naive_alphabi(thank);
    if (targetBits.slice(0,bitspec.length) == bitspec) {
      setMatchStat(bitspec.length);
    } else {
      setMatchStat(0);
    }
  } else {
    setMatchStat('init');
  }
}

realName.addEventListener('input', updateTarget);
thankedName.addEventListener('input', updateMatch);

const supportsDigest = (crypto && crypto.subtle && crypto.subtle.digest);

if (!supportsDigest) {
  document.getElementById('main').hidden = true;
  document.getElementById('failure').innerHTML =
    "Sorry, you'll need to use a newer browser. " +
    "I threw this together in a hurry, so I didn't have time to make it work "+
    "in browsers that don't support the <a href=\"https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#Browser_compatibility\">SubtleCrypto API</a>.";
  document.getElementById('failure').hidden = false;
}
