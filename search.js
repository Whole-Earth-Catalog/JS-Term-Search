var fs = require('fs');
var parser = require('xml2json');
let suffix = Buffer.from("</record>", 'utf8');
const {
    promisify
} = require('util');
var GoogleSpreadsheet = require('google-spreadsheet');
let keys = [];
let decade = -1;
/* Because JS loops are asyncronous, use markers to confirm all loops have been
   completed before iterating */
let marks = [0, 0, 0, 0, 0, 0, 0];
/* Used to store most necessary info */
function dict(key, words) {
    this.key = key;
    this.words = words;
    this.dec = [];
    this.count = [];
}
/* Split by lang to get most specific stats */
let eng = {
    keys: []
};
let dut = {
    keys: []
};
let fre = {
    keys: []
};
let ger = {
    keys: []
};
let ita = {
    keys: []
};
let lat = {
    keys: []
};
let spa = {
    keys: []
};
/* Simple decade calculator */
async function getDecade(json) {
    for (let i = 0; i < json.record.controlfield.length; i++) {
        if (json.record.controlfield[i].tag == 8) {
            let year = parseInt(json.record.controlfield[i].$t.substring(7, 11).trim());
            decade = parseInt(year / 10) * 10;
        }
    }
}

/* This is where the google API is used */
async function accessSpreadsheet() {
    /* String is the url for the spreadsheet */
    var doc = new GoogleSpreadsheet(/*[REDACTED]*/);
    /* Uses my client secret to access the spreadsheet */
    var creds = require('./client_secret.json');
    /* Attempt to access the spreadsheet */
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[0];
    /* Simple formatting */
    const rows = await promisify(sheet.getRows)({
        offset: 1
    });
    /* Counter to know when the current key changes */
    let old = 0;
    rows.forEach(row => {
        /* Add each new key to the key array */
        if (row.keys != "") {
            keys[keys.length] = row.keys.toLowerCase();
        }
        /* When a new key has been added, create a new dictionary in each language */
        if (keys.length != old) {
            eng.keys[eng.keys.length] = new dict(keys[old], []);
            dut.keys[dut.keys.length] = new dict(keys[old], []);
            fre.keys[fre.keys.length] = new dict(keys[old], []);
            ger.keys[ger.keys.length] = new dict(keys[old], []);
            ita.keys[ita.keys.length] = new dict(keys[old], []);
            lat.keys[lat.keys.length] = new dict(keys[old], []);
            spa.keys[spa.keys.length] = new dict(keys[old], []);
        }
        /* For each row, detect its language and add the word to the correct language's dictionary */
        if (row.english != "") {
            eng.keys[keys.length - 1].words[eng.keys[keys.length - 1].words.length] = row.english.toLowerCase();
        }

        if (row.dutch != "") {
            dut.keys[keys.length - 1].words[dut.keys[keys.length - 1].words.length] = row.dutch.toLowerCase();
        }

        if (row.french != "") {
            fre.keys[keys.length - 1].words[fre.keys[keys.length - 1].words.length] = row.french.toLowerCase();
        }

        if (row.german != "") {
            ger.keys[keys.length - 1].words[ger.keys[keys.length - 1].words.length] = row.german.toLowerCase();
        }

        if (row.italian != "") {
            ita.keys[keys.length - 1].words[ita.keys[keys.length - 1].words.length] = row.italian.toLowerCase();
        }

        if (row.latin != "") {
            lat.keys[keys.length - 1].words[lat.keys[keys.length - 1].words.length] = row.latin.toLowerCase();
        }

        if (row.spanish != "") {
            spa.keys[keys.length - 1].words[spa.keys[keys.length - 1].words.length] = row.spanish.toLowerCase();
        }
        /* Update counter */
        old = keys.length;
    });
}

async function run(n) {
    /* Firstly, populate the dictionaries */
    await accessSpreadsheet();
    /* dr59.xml had to be spliit to fit inside javascripts buffer size, select the part being accessed */
    fs.readFile(`../../Publisher Stats/records${n}`, function(err, data) {
        let recs = data.toString().split("</record>");
        total = recs.length - 1;
        /* While loop instead of for loop so we can control when j increments */
        let j = 0;
        let first = true;
        while (j < total) {
            /* Only need to run this once per cycle, other cycles just waiting for completion */
            if (first) {
                first = false;
                var json = JSON.parse(parser.toJson(recs[j] + suffix, {
                    reversible: true
                }));
                getDecade(json);
                /* Cycle through tags */
                for (let i = 0; i < json.record.datafield.length; i++) {
                    if (json.record.datafield[i].tag == 245) {
                        let title = "";
                        if (json.record.datafield[i].subfield[0] != null) {
                            /* Extract data from 245 tag */
                            for (let z = 0; z < json.record.datafield[i].subfield.length; z++) {
                                if (json.record.datafield[i].subfield[z].code == 'a') {
                                    title = json.record.datafield[i].subfield[z].$t.toLowerCase();
                                }
                            }
                        }
                        if (json.record.datafield[i].subfield != null) {
                            if (json.record.datafield[i].subfield.code == 'a') {
                                title = json.record.datafield[i].subfield.$t.toLowerCase();
                            }
                        }
                        /* Check title against dictionaries */
                        for (let k = 0; k < keys.length; k++) {
                            for (let w = 0; w < eng.keys[k].words.length; w++) {
                                /* if they have asterisks, check if word is contained */
                                if (eng.keys[k].words[w].includes("*")) {
                                    if (title.includes(eng.keys[k].words[w].split("*")[0])) {
                                        if (eng.keys[k].dec.indexOf(decade) == -1) {
                                            eng.keys[k].dec[eng.keys[k].dec.length] = decade;
                                            eng.keys[k].count[eng.keys[k].dec.length - 1] = 1;
                                        } else {
                                            eng.keys[k].count[eng.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                    /* Otherwise, check for matching words */
                                } else {
                                    if (title.split(" ").indexOf(eng.keys[k].words[w]) != -1) {
                                        if (eng.keys[k].dec.indexOf(decade) == -1) {
                                            eng.keys[k].dec[eng.keys[k].dec.length] = decade;
                                            eng.keys[k].count[eng.keys[k].dec.length - 1] = 1;
                                        } else {
                                            eng.keys[k].count[eng.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                /* Update markers when completed */
                                if (w == eng.keys[k].words.length - 1) marks[0] = 1;
                            }
                            /* Same process but for other languages */
                            for (let w1 = 0; w1 < dut.keys[k].words.length; w1++) {
                                if (dut.keys[k].words[w1].includes("*")) {
                                    if (title.includes(dut.keys[k].words[w1].split("*")[0])) {
                                        if (dut.keys[k].dec.indexOf(decade) == -1) {
                                            dut.keys[k].dec[dut.keys[k].dec.length] = decade;
                                            dut.keys[k].count[dut.keys[k].dec.length - 1] = 1;
                                        } else {
                                            dut.keys[k].count[dut.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                } else {
                                    if (title.split(" ").indexOf(dut.keys[k].words[w1]) != -1) {
                                        if (dut.keys[k].dec.indexOf(decade) == -1) {
                                            dut.keys[k].dec[dut.keys[k].dec.length] = decade;
                                            dut.keys[k].count[dut.keys[k].dec.length - 1] = 1;
                                        } else {
                                            dut.keys[k].count[dut.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                if (w1 == dut.keys[k].words.length - 1) marks[1] = 1;
                            }
                            for (let w2 = 0; w2 < fre.keys[k].words.length; w2++) {
                                if (fre.keys[k].words[w2].includes("*")) {
                                    if (title.includes(fre.keys[k].words[w2].split("*")[0])) {
                                        if (fre.keys[k].dec.indexOf(decade) == -1) {
                                            fre.keys[k].dec[fre.keys[k].dec.length] = decade;
                                            fre.keys[k].count[fre.keys[k].dec.length - 1] = 1;
                                        } else {
                                            fre.keys[k].count[fre.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                } else {
                                    if (title.split(" ").indexOf(fre.keys[k].words[w2]) != -1) {
                                        if (fre.keys[k].dec.indexOf(decade) == -1) {
                                            fre.keys[k].dec[fre.keys[k].dec.length] = decade;
                                            fre.keys[k].count[fre.keys[k].dec.length - 1] = 1;
                                        } else {
                                            fre.keys[k].count[fre.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                if (w2 == fre.keys[k].words.length - 1) marks[2] = 1;
                            }
                            for (let w3 = 0; w3 < ger.keys[k].words.length; w3++) {
                                if (ger.keys[k].words[w3].includes("*")) {
                                    if (title.includes(ger.keys[k].words[w3].split("*")[0])) {
                                        if (ger.keys[k].dec.indexOf(decade) == -1) {
                                            ger.keys[k].dec[ger.keys[k].dec.length] = decade;
                                            ger.keys[k].count[ger.keys[k].dec.length - 1] = 1;
                                        } else {
                                            ger.keys[k].count[ger.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                } else {
                                    if (title.split(" ").indexOf(ger.keys[k].words[w3]) != -1) {
                                        if (ger.keys[k].dec.indexOf(decade) == -1) {
                                            ger.keys[k].dec[ger.keys[k].dec.length] = decade;
                                            ger.keys[k].count[ger.keys[k].dec.length - 1] = 1;
                                        } else {
                                            ger.keys[k].count[ger.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                if (w3 == ger.keys[k].words.length - 1) marks[3] = 1;
                            }
                            for (let w4 = 0; w4 < ita.keys[k].words.length; w4++) {
                                if (ita.keys[k].words[w4].includes("*")) {
                                    if (title.includes(ita.keys[k].words[w4].split("*")[0])) {
                                        if (ita.keys[k].dec.indexOf(decade) == -1) {
                                            ita.keys[k].dec[ita.keys[k].dec.length] = decade;
                                            ita.keys[k].count[ita.keys[k].dec.length - 1] = 1;
                                        } else {
                                            ita.keys[k].count[ita.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                } else {
                                    if (title.split(" ").indexOf(ita.keys[k].words[w4]) != -1) {
                                        if (ita.keys[k].dec.indexOf(decade) == -1) {
                                            ita.keys[k].dec[ita.keys[k].dec.length] = decade;
                                            ita.keys[k].count[ita.keys[k].dec.length - 1] = 1;
                                        } else {
                                            ita.keys[k].count[ita.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                if (w4 == ita.keys[k].words.length - 1) marks[4] = 1;
                            }
                            for (let w5 = 0; w5 < lat.keys[k].words.length; w5++) {
                                if (lat.keys[k].words[w5].includes("*")) {
                                    if (title.includes(lat.keys[k].words[w5].split("*")[0])) {
                                        if (lat.keys[k].dec.indexOf(decade) == -1) {
                                            lat.keys[k].dec[lat.keys[k].dec.length] = decade;
                                            lat.keys[k].count[lat.keys[k].dec.length - 1] = 1;
                                        } else {
                                            lat.keys[k].count[lat.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                } else {
                                    if (title.split(" ").indexOf(lat.keys[k].words[w5]) != -1) {
                                        if (lat.keys[k].dec.indexOf(decade) == -1) {
                                            lat.keys[k].dec[lat.keys[k].dec.length] = decade;
                                            lat.keys[k].count[lat.keys[k].dec.length - 1] = 1;
                                        } else {
                                            lat.keys[k].count[lat.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                if (w5 == lat.keys[k].words.length - 1) marks[5] = 1;
                            }
                            for (let w6 = 0; w6 < spa.keys[k].words.length; w6++) {
                                if (spa.keys[k].words[w6].includes("*")) {
                                    if (title.includes(spa.keys[k].words[w6].split("*")[0])) {
                                        if (spa.keys[k].dec.indexOf(decade) == -1) {
                                            spa.keys[k].dec[spa.keys[k].dec.length] = decade;
                                            spa.keys[k].count[spa.keys[k].dec.length - 1] = 1;
                                        } else {
                                            spa.keys[k].count[spa.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                } else {
                                    if (title.split(" ").indexOf(spa.keys[k].words[w6]) != -1) {
                                        if (spa.keys[k].dec.indexOf(decade) == -1) {
                                            spa.keys[k].dec[spa.keys[k].dec.length] = decade;
                                            spa.keys[k].count[spa.keys[k].dec.length - 1] = 1;
                                        } else {
                                            spa.keys[k].count[spa.keys[k].dec.indexOf(decade)]++;
                                        }
                                    }
                                }
                                if (w6 == spa.keys[k].words.length - 1) marks[6] = 1;
                            }
                        }
                    }
                    /* Make sure everything is completed before saving files, thanks async */
                    if (j == total - 1 && i == json.record.datafield.length - 1) {
                        for (let k = 0; k < keys.length; k++) {
                            console.log(keys[k] + ":\n");
                            /* Build output strings */
                            let output = "Decade\tcount\n";
                            if (n != 0) output = "";
                            for (let o = 0; o < eng.keys[k].dec.length; o++) {
                                output += eng.keys[k].dec[o] + "\t" + eng.keys[k].count[o] + "\n";
                                if (o == eng.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/eng/eng_${keys[k]}${n}.tsv`, output, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file eng ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                            let output1 = "Decade\tcount\n";
                            if (n != 0) output1 = "";
                            for (let o1 = 0; o1 < dut.keys[k].dec.length; o1++) {
                                console.log(dut.keys[k]);
                                output1 += dut.keys[k].dec[o1] + "\t" + dut.keys[k].count[o1] + "\n";
                                if (o1 == dut.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/dut/dut_${keys[k]}${n}.tsv`, output1, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file dut ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                            let output2 = "Decade\tcount\n";
                            if (n != 0) output2 = "";
                            for (let o2 = 0; o2 < fre.keys[k].dec.length; o2++) {
                                output2 += fre.keys[k].dec[o2] + "\t" + fre.keys[k].count[o2] + "\n";
                                if (o2 == fre.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/fre/fre_${keys[k]}${n}.tsv`, output2, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file fre ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                            let output3 = "Decade\tcount\n";
                            if (n != 0) output3 = "";
                            for (let o3 = 0; o3 < ger.keys[k].dec.length; o3++) {
                                output3 += ger.keys[k].dec[o3] + "\t" + ger.keys[k].count[o3] + "\n";
                                if (o3 == ger.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/ger/ger_${keys[k]}${n}.tsv`, output3, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file ger ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                            let output4 = "Decade\tcount\n";
                            if (n != 0) output4 = "";
                            for (let o4 = 0; o4 < ita.keys[k].dec.length; o4++) {
                                output4 += ita.keys[k].dec[o4] + "\t" + ita.keys[k].count[o4] + "\n";
                                if (o4 == ita.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/ita/ita_${keys[k]}${n}.tsv`, output4, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file ita ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                            let output5 = "Decade\tcount\n";
                            if (n != 0) output5 = "";
                            for (let o5 = 0; o5 < lat.keys[k].dec.length; o5++) {
                                output5 += lat.keys[k].dec[o5] + "\t" + lat.keys[k].count[o5] + "\n";
                                if (o5 == lat.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/lat/lat_${keys[k]}${n}.tsv`, output5, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file lat ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                            let output6 = "Decade\tcount\n";
                            if (n != 0) output6 = "";
                            for (let o6 = 0; o6 < spa.keys[k].dec.length; o6++) {
                                output6 += spa.keys[k].dec[o6] + "\t" + spa.keys[k].count[o6] + "\n";
                                if (o6 == spa.keys[k].dec.length - 1) {
                                    fs.writeFile(`./decades/spa/spa_${keys[k]}${n}.tsv`, output6, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        console.log(`The file spa ${keys[k]} ${n} was saved!`);
                                    });
                                }
                            }
                        }
                    }
                    /* Only increment J when all marks filled */
                    if (marks.indexOf(0) == -1) {
                        j++;
                        first = true;
                        marks = [0, 0, 0, 0, 0, 0, 0];
                    }
                }
            }
        }
    });
}

console.log(process.argv[2]);
run(process.argv[2]);
