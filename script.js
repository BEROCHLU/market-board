'use strict';

import {
	TEKITOU
} from './tekitou.js'; //mjsはサーバ側でMIME未対応

const minaide = () => decodeURIComponent(TEKITOU).replace(/[Ａ-Ｚａ-ｚ０-９＿]/g, s => String.fromCharCode(s.charCodeAt(0) - 65248)); // himitsu

const MARKET_BOARD = [{
	'sectorName': 'Major ETF',
	'sectorArray': ['SPY', 'DIA', 'QQQ', 'IWM']
}, {
	'sectorName': 'Banks',
	'sectorArray': ['GS', 'MS', 'JPM', 'WFC', 'C', 'BAC', 'BCS', 'DB']
}, {
	'sectorName': 'FANGAM',
	'sectorArray': ['FB', 'AAPL', 'NFLX', 'GOOG', 'AMZN', 'MSFT']
}, {
	'sectorName': 'Tech',
	'sectorArray': ['TWTR', 'SNAP', 'SQ', 'AMD', 'NVDA']
}, {
	'sectorName': 'Cryptos',
	'sectorArray': ['BTCUSDT', 'ETHUSDT', 'XRPUSDT']
}, {
	'sectorName': 'Inverse ETF',
	'sectorArray': ['TZA', 'FAZ', 'SDOW', 'SQQQ', 'SPXU', 'VXX', 'UVXY', 'TVIX']
}, {
	'sectorName': 'Commodity&Bond ETF',
	'sectorArray': ['GLD', 'USO', 'TLT']
}, {
	'sectorName': 'MegaCaps',
	'sectorArray': ['BA', 'UNH', 'MMM', 'HD', 'MCD', 'V', 'JNJ', 'GE', 'BRK.B', 'CVX', 'PG', 'WMT']
}, {
	'sectorName': 'CustomizeSector',
	'sectorArray': []
}];

const URL_API = 'https://cloud.iexapis.com/stable/stock/market/batch';
let arrTicker = [];
let arrStoregeTicker = [];
const LOCAL_STORAGE = 'userArray';
const SEC = 1000;

// avoid error null.toFixed
const checkNull = _.curry((jsonQuote, strProp, strTicker) => {

	let fValue = parseFloat(jsonQuote[strProp])

	if (isNaN(fValue)) { //check null
		return '-';
	}

	if (strTicker === 'XRPUSDT' && strProp === 'latestPrice') {
		return fValue.toFixed(5);
	}

	if (strProp === 'changePercent') {
		fValue *= 100;
		return fValue.toFixed(2) + '%';
	}

	return fValue.toFixed(2);
});

const checkGetText = () => {
	let ticker = $('#addtext').val().trim(); //console.log(ticker);
	$('#addtext').val('');
	return /^[A-Z]+([-=\.\+\^][A-Z]?)?$/i.test(ticker) && ticker.toUpperCase() || null;
}

const createTableRow = ticker => {

	let trtdHtml = `<tr data-ticker="${ticker}">
<td class="stock-ticker"><a href="https://iextrading.com/apps/stocks/${ticker}" target="_blank">${ticker}</a></td>
<td class="stock-price"></td>
<td class="stock-change"></td>
<td class="stock-changepercent"></td>
<td class="stock-time"></td>
<td class="stock-chart"><input type="button" value="chart" class="chart-button" data-ticker="${ticker}" data-title=""></td>
</tr>`;

	return trtdHtml;
}

//update stock data
const updateQuote = () => {

	let arrfilter = ['companyName', 'latestPrice', 'change', 'changePercent', 'latestVolume', 'latestUpdate'];
	let url = `${URL_API}?token=${minaide()}&types=quote&symbols=${arrTicker.map(ticker => encodeURIComponent(ticker)).join(',')}&filter=${arrfilter.join(',')}`;

	fetch(url, {
			cache: 'no-cache'
		})
		.then(response => {
			if (response.ok) {
				($('header').css('background-color') !== 'rgb(230, 230, 250)') && $('header').css('background-color', 'lavender');
			} else {
				$('header').css('background-color', 'orange');
				console.log(response);
			}

			return response.json();
		})
		.then(json => {
			for (let ticker of arrTicker) {

				if (typeof (json[ticker]) === 'undefined') {
					continue;
				} //"return;" is not good. It occurs to a bug.

				const jsonQuote = json[ticker].quote;
				const curried_checkNull = checkNull(jsonQuote); //checkNullをカリー化してquoteを固定引数とする

				const fPrice = curried_checkNull('latestPrice', ticker);
				const fChange = curried_checkNull('change', ticker);
				const strChangeParcent = curried_checkNull('changePercent', ticker);
				let strTimestamp = new Date(jsonQuote.latestUpdate);

				strTimestamp = strTimestamp.toLocaleTimeString('en-US', {
					timeZone: 'America/New_York',
					hour12: false
				}); //convert to EDT

				$(`[data-ticker="${ticker}"] > .stock-ticker`).attr('title', jsonQuote.companyName); //ツールチップにcompanyName付与
				$(`[data-ticker="${ticker}"] > .stock-price`).text(fPrice);
				$(`[data-ticker="${ticker}"] > .stock-change`).text(fChange);
				$(`[data-ticker="${ticker}"] > .stock-changepercent`).text(strChangeParcent);
				$(`[data-ticker="${ticker}"] > .stock-time`).text(strTimestamp);
				//data属性にcompanyName付与 jquery独自のdata属性は使わない
				$(`[data-ticker="${ticker}"] > .stock-chart > input.chart-button`).attr('data-title', jsonQuote.companyName);

			} //for
		})
		.catch(e => { //promiseのcatchは最後に書く
			$('header').css('background-color', 'tomato');
			console.log(e);
		}); //fetch
}

/**
 * @summary draw a chart
 * @param {*} v jQuery DOM
 */
const chartevent = (v) => {

	$('html, body').animate({
		scrollTop: $('#cn').offset().top - 25
	});

	const strTicker = v.target.dataset.ticker;
	const strTitle = v.target.dataset.title;
	const URL_HIST = `https://cloud.iexapis.com/stable/stock/${strTicker}/chart/6m?token=${minaide()}`;

	fetch(URL_HIST)
		.then(response => response.json())
		.then(arrJson => {

			if (arrJson.length === 0) {
				return;
			}

			let arrDate = _.map(arrJson, 'date'); // xAxis.data
			let arrPlot = _.map(arrJson, json => [json.open, json.close, json.low, json.high]); //open close low high

			let plot_min = _.minBy(arrJson, json => json.low);
			let plot_max = _.maxBy(arrJson, json => json.high);

			plot_min = _.floor(plot_min.low * 0.97);
			plot_max = _.ceil(plot_max.high * 1.03);

			let pandaChart = echarts.init(document.getElementById('cn'));

			let option = {
				title: {
					text: strTitle,
					textStyle: {
						fontSize: 15
					},
					top: '2%',
					left: 'center'
				},
				xAxis: {
					data: arrDate
				},
				yAxis: {
					min: plot_min,
					max: plot_max
				},
				tooltip: {
					trigger: 'item', //item | axis | node
					axisPointer: {
						type: 'cross'
					}
				},
				series: [{
					type: 'k',
					data: arrPlot
				}]
			};

			pandaChart.setOption(option);
		})
		.catch(e => console.log(e));
}

/**
 * @summary main
 */
for (let objSector of MARKET_BOARD) {

	let tBodyHtml = objSector.sectorArray.map(ticker => {

		ticker = ticker.toUpperCase();
		arrTicker.push(ticker);
		return createTableRow(ticker);

	}).join('');

	let strSection = `<section>
<h4>${objSector.sectorName}</h4>
<table><tbody>${tBodyHtml}</tbody></table>
</section>`;

	$('.section-tables').append(strSection);
}

{ //initialization and CustomizeSection
	localStorage.getItem(LOCAL_STORAGE) || (localStorage.setItem(LOCAL_STORAGE, JSON.stringify(arrStoregeTicker)), console.log('initialized localStorage:CustomizeSector'));

	let strGetStorege = localStorage.getItem(LOCAL_STORAGE);

	arrStoregeTicker = JSON.parse(strGetStorege); //console.log(arrStoregeTicker);

	for (let ticker of arrStoregeTicker) {
		$('.section-tables section:last table > tbody').append(createTableRow(ticker));
		arrTicker.push(ticker);
	}
	// disable button for crypto section
	document.querySelector('input.chart-button[data-ticker="BTCUSDT"]').disabled = true;
	document.querySelector('input.chart-button[data-ticker="ETHUSDT"]').disabled = true;
	document.querySelector('input.chart-button[data-ticker="XRPUSDT"]').disabled = true;
}

//create header clock
setInterval(() => {
	const moDate = moment(new Date()).format('YYYY/MM/DD HH:mm:ss');
	$('#update_timestamp').html(`${moDate}`);
}, 1.0 * SEC);

updateQuote();

//!event add table row and change localstorage
$('#addbutton').click(function () {

	let ticker = checkGetText();

	if (!ticker) {
		alert('invalid ticker');
		return;
	} else if (arrTicker.indexOf(ticker) !== -1) {
		alert('already registered');
		return;
	}

	$('section:last table > tbody').append(createTableRow(ticker));
	$('input.chart-button:last').click(chartevent);

	arrTicker.push(ticker);
	arrStoregeTicker.push(ticker);
	localStorage.setItem(LOCAL_STORAGE, JSON.stringify(arrStoregeTicker));

});

//!event remove table row and change localstorage
$('#delbutton').click(function () {

	let ticker = checkGetText();

	if (!ticker) return;

	$('.section-tables section:last table > tbody > tr').each(function () {

		let strTicker = $(this).find('a').text();

		(strTicker === ticker) && $(this).remove();

	});
	//filterを使った配列の削除。アロー関数を使うとこんなにも短く書ける！arrTickerの要素削除はしなくてもよい。
	arrStoregeTicker = arrStoregeTicker.filter(v => v !== ticker); //lodash uniq
	localStorage.setItem(LOCAL_STORAGE, JSON.stringify(arrStoregeTicker));

});

//!event clear all
$('#resetbutton').click(function () {

	localStorage.removeItem(LOCAL_STORAGE); //clear localstorage
	arrStoregeTicker = []; //clear array

	$('#addtext').val('');

	$('.section-tables section:last table > tbody > tr').each(function () {
		$(this).remove();
	});
});

//!event Expand margin-bottom in order for the smartphone's virtual keyboard not to hide input textbox when focusin.
$('.customize-ticker > :not(#resetbutton)').focusin(function () {
	/(iPhone|iPad|Android)/.test(navigator.userAgent) && ($('.customize-ticker').css('margin-bottom', '280px'), window.scrollTo(0, document.body.scrollHeight));
});

//!event Reset margin-bottom when focusout.
$('.customize-ticker > :not(#resetbutton)').focusout(function () {
	/(iPhone|iPad|Android)/.test(navigator.userAgent) && $('.customize-ticker').css('margin-bottom', '40px');
});

//!event manual update
$('#reloadbutton').click(function () {
	//location.reload();
	updateQuote();
});

//!event draw a chart
$('input.chart-button').click(chartevent);