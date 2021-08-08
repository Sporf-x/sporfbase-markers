#!/usr/bin/env node

const http = require("http");
const fs = require('fs');

async function main() {
  const title = "Neolibcraft_Map_Data";
  const text = await getWikiText(title);
  //console.log(text);

  const tables = getWikiTables(text);
  //console.log(JSON.stringify(tables));

  // Save JSON out (for debugging)
  
  // TODO: convert all titles to detect wiki link formatting and convert it into the HTML-based formatting MapCrafter can use
  const claims = tables["CLAIMDATA"].rows.map(([points, color, fillColor, title]) => {
    try {
      const values = {
	points: JSON.parse(`[${points}]`),
	color,
	fillColor,
	fillOpacity: 0.3,
	title
      };
      return values;
    } catch( ex ) {
      console.log(`Exception processing claim data: ${ex}`);
      console.log("~~CLAIM DATA~~");
      console.log([points,color,fillColor,title]);
    }
  });
  
  const poi = tables["POIDATA"].rows.map(([x, y, z, title]) => ({
    pos: [Number(x), Number(y), Number(z)],
    title: title,
    // TODO: Image
	/*
		Looked into this: couldn't find a way to use remote icons in the Mapcrafter docs*, so
		was thinking we'd just download the images to the working folder if not already present;
		however, the API** apears to be down on my end so I couldn't test this out.
				
		*	https://docs.mapcrafter.org/builds/1.2/markers.html
		** 	https://www.mediawiki.org/wiki/Special:ApiSandbox#action=query&format=json&maxlag=&origin=&prop=imageinfo&titles=File%3AAlbert%20Einstein%20Head.jpg&iiprop=url
	*/
  }));
  const features = tables["GEODATA"].rows.map(([x, y, z, title]) => ({
    pos: [Number(x), Number(y), Number(z)],
    title: title,
    // TODO: Image
  }));

  const jsonMarkers = JSON.stringify({claims, poi, features}, null, 2);
  //console.log(jsonMarkers);

  // Catenate files
  const filePath = "./markers.js";
  const markersCode = fs.readFileSync(filePath, "utf8");

  const resultString = `var generatedMarkerData = ${jsonMarkers};

${markersCode}`;
  fs.writeFileSync("./markers_catenated.js", resultString);
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
