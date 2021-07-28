#!/usr/bin/env node

const http = require("http");
const fs = require('fs');

async function main() {
  const title = "Neolibcraft_Map_Data";
  const text = await getWikiText(title);
  //console.log(text);

  const tables = getWikiTables(text);
  //console.log(JSON.stringify(tables));

  const claims = tables["CLAIMDATA"].rows.map(([points, color, fillColor, title]) => ({
    points: JSON.parse(`[${points}]`),
    color,
    fillColor,
    fillOpacity: 0.3,
    title
  }));
  const poi = tables["POIDATA"].rows.map(([x, y, z, title]) => ({
    pos: [Number(x), Number(y), Number(z)],
    title: title,
    // TODO: Image
  }));

  console.log(JSON.stringify({claims, poi}));
}


function getWikiText(title) {
  return new Promise((resolve, reject) => {
    const url = '/mediawiki/api.php?action=parse&format=json&prop=wikitext'
	  + `&page=${title}`;
    //console.log(`Requesting wiki text: ${title}`);
    const forwardReq = http.request(
      {
	hostname: "sporfbase.com",
	port: 80,
	path: url,
	headers: {},
	method: "GET",
      },
      (clientResult) => {
	let data = "";

	clientResult.on("data", (d) => {
	  data += d;
	});
	clientResult.on("end", () => {
	  //console.log(data)
	  try {
	    const out = JSON.parse(data);
	    const wikitext = out.parse.wikitext["*"];
	    resolve( wikitext );
	  } catch (e) {
	    console.log("[windows] Error sending to client:");
	    console.log(e);
	    console.log("[windows] Raw response:");
	    console.log(data);
	    throw e;
	  }
	});
      }
    );
    forwardReq.on("error", (e) => {
      console.error(`problem with request: ${e.message}`);
      reject({error: e});
    });
    forwardReq.end();
  });
}

function getWikiTables(text) {
  const lines = text.split("\n");
  let row = [];
  let isTable = false;
  let tables = {};
  let rows = [];
  let title = undefined;
  for( let line of lines ) {
    if( line.match(/^{\|/) ) {
      isTable = true;
      continue;
    }
    if( line.match(/^\|}/) ) {
      isTable = false;
      if( row.length ) {
	rows.push(row);
      }
      row = [];
      tables[tableTitle] = {
	rows: rows
      };
      rows = [];
      title = undefined;
      continue;
    }
    if( isTable ) {
      if( line.match(/^\|\+/) ) {
	tableTitle = line.match(/^\|\+(.*)/)[1];
      }
      if( line.match(/^\|-/) ) {
	if( row.length ) {
	  rows.push(row);
	}
	row = [];
	continue;
      } else if( line.match(/^\| /) ) {
	row.push(line.match(/^\| (.*)/)[1]);
      } else {
	//console.log(`no match: "${line}"`);
      }
    }
  }
  return tables;
}

main();
