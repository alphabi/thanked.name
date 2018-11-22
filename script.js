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
const draftArea = document.getElementById('draftarea');
const draftButton = document.getElementById('draft');

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
    return getSha256Bits(targetName).then(setTarget).then(updateSuggestions);
  } else {
    setTarget(null);
    updateSuggestions();
  }
}

function getMatchLength(thank) {
  const bitspec = naive_alphabi(thank);
  if (targetBits.slice(0, bitspec.length) == bitspec) {
    return bitspec.length;
  } else {
    setMatchStat(0);
  }
}

function updateMatch() {
  const thank = superficial_latin(thankedName.value).trim();
  if (thank && targetBits) {
    setMatchStat(getMatchLength(thank));
  } else {
    setMatchStat('init');
  }
}

function updateThanked() {
  updateMatch();
  updateSuggestions();
}

function titleCase(s) {
  return s.slice(0,1).toUpperCase() + s.slice(1);
}

let bitdicts = null;

function setupBitdictsFromWordlist(list) {
  const lines = /\S+/g;
  bitdicts = new Map();
  let line;
  while (line = lines.exec(list)) {
    const word = superficial_latin(line[0]).trim();
    const bits = naive_alphabi(word);
    let bitdict = bitdicts.get(bits);
    if (!bitdict) bitdicts.set(bits, bitdict = new Set());
    bitdict.add(titleCase(word));
  }
  // remove the initial "Loading" element
  draftArea.removeChild(draftArea.firstChild);
  updateSuggestions();
}

function toggleDrafting() {
  if (draftArea.hidden) {
    // if we're turning draft mode on for the first time
    if (!bitdicts) {
      // Load the words we need
      bitdicts = fetch(wordlistUrl)
        .then(res => res.text()).then(setupBitdictsFromWordlist);
    } else {
    }
  }
  draftArea.hidden = !draftArea.hidden;

  if (!draftArea.hidden) updateSuggestions();
}

draftButton.addEventListener('click', toggleDrafting);

function addTargetWordToThanked(evt) {
  if (evt.target.matches('.word')) {
    const word = evt.target.textContent;
    if (thankedName.value) {
      thankedName.value += ' ' + word;
    } else {
      thankedName.value = word;
    }
    updateThanked();
  }
}

draftArea.addEventListener('click', addTargetWordToThanked);

function updateSuggestions() {
  const thank = superficial_latin(thankedName.value).trim();
  const matchLength = targetBits && getMatchLength(thank);

  // don't show any suggestions when there's nothing to suggest,
  // or the match is bad
  if (!targetBits || matchLength == 0 && thank != '') {
    const range = document.createRange();
    range.selectNodeContents(draftArea);
    range.deleteContents();

  // When the match is OK and we are drafting
  } else if (bitdicts && !bitdicts.then && !draftArea.hidden) {
    // Gather words
    const words = [];
    let bitsearch = targetBits.slice(matchLength);
    while (bitsearch) {
      const bitdict = bitdicts.get(bitsearch);
      if (bitdict) {
        for (let word of bitdict) {
          words[words.length] = word;
        }
      }
      bitsearch = bitsearch.slice(0, -1);
    }

    for (let i = draftArea.children.length; i < words.length; ++i) {
      // insert any necessary new entries
      draftArea.appendChild(templateListWord.cloneNode());
    }

    if (draftArea.children.length > words.length) {
      const range = document.createRange();
      range.setStartAfter(draftArea.children[words.length]);
      range.setEndAfter(draftArea.lastChild);
      range.deleteContents();
    }

    for (let i = 0; i < words.length; ++i) {
      draftArea.children[i].textContent = words[i];
    }
  }
}

realName.addEventListener('input', updateTarget);
thankedName.addEventListener('input', updateThanked);

const supportsDigest = (crypto && crypto.subtle && crypto.subtle.digest);

if (!supportsDigest) {
  document.getElementById('main').hidden = true;
  document.getElementById('failure').innerHTML =
    "Sorry, you'll need to use a newer browser. " +
    "I threw this together in a hurry, so I didn't have time to make it work "+
    "in browsers that don't support the <a href=\"https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#Browser_compatibility\">SubtleCrypto API</a>.";
  document.getElementById('failure').hidden = false;
}
