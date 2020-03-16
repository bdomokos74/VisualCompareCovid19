'use strict';
let rawData = undefined;
let procData = undefined;
let countryData = undefined;
let countrySummary = undefined;

let config = {
    visibleCountries: new Set(),
    logScale: false
};

let formatDate = d3.timeFormat("%Y-%m-%d");
let z = d3.scaleOrdinal(d3.schemeCategory10);

d3.csv("../data/time_series_19-covid-Confirmed.csv").then(
    d => {
        rawData = d;
        procData = rawData.map(getDataPoint).filter( d => d.data[d.data.length-1].confirmed!=0);
        countryData = aggregateCountries(procData);
        countrySummary = getCountrySummary(countryData);
        showCountryList(countrySummary);

        showCountries(['Italy', 'Spain', 'Germany', 'Switzerland']);

        d3.select("#logScale").on("change", (d, i, nodes) => {
            config.logScale = nodes[i].checked;
            console.log("logscale:" + config.logScale);
            updateChart(countryData, config);
        });
        d3.select("#selectAllCountries").on("change", (d, i, nodes) => {
            config.visibleCountries = new Set();
            setAllCountries(nodes[i].checked);
            updateChart(countryData, config);
        });

        d3.selectAll("input.countrySel").on("change", (d, i, nodes) => {
            // console.log(nodes[i].dataset.country+": "+nodes[i].checked);
            if (nodes[i].checked) {
                config.visibleCountries.add(d.country);
            } else {
                config.visibleCountries.delete(d.country);
            }
            updateChart(countryData, config);
        });

        updateChart(countryData, config);

        function setAllCountries(status) {
            d3.selectAll("input.countrySel").each( (d, i, nodes) => {
                nodes[i].checked = status;
                if(status) config.visibleCountries.add(d.country);
            });
        }
        function showCountries(lst) {
            config.visibleCountries = new Set(lst);
            d3.selectAll("input.countrySel").each( (d, i, nodes) => {
                if(config.visibleCountries.has(d.country)) {
                    nodes[i].checked = true;
                }
            });
        }
    }
);

// https://github.com/CSSEGISandData/COVID-19
function updateChart(data, config) {
    let svg = d3.select("#chart"),
        margin = {top: 15, right: 35, bottom: 15, left: 85},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    svg.selectAll("*").remove();

    let processedData = data.filter( d => config.visibleCountries.has(d.country));
    if(!processedData||processedData.length===0) return;


    let x = d3.scaleLinear()
        .rangeRound([margin.left, width - margin.right])
        .domain(getExtent(processedData.map( d => d.data), d => d.day));

    let scaleY = d3.scaleLinear();
    if (config.logScale) {
        scaleY = d3.scaleLog();
    }
    var y = scaleY
        .rangeRound([height - margin.bottom, margin.top])
        .domain(getExtent(processedData.map(d=>d.data), it => it.confirmed));

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + (height - margin.bottom) + ")")
        .call(d3.axisBottom(x));

    svg.append("text")      // text label for the x-axis
        .attr("x", width / 2 )
        .attr("y",  height + margin.bottom)
        .style("text-anchor", "middle")
        .text("Days since first confirmed case in that country");

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(" + margin.left + ",0)")
        .call(d3.axisLeft(y));

    svg.append("text")      // text label for the y-axis
        .attr("y",120 - margin.left)
        .attr("x", 50 - (height / 2))
        .attr("transform", "rotate(-90)")
        .style("text-anchor", "end")
        .text("Confirmed cases");

    var line = d3.line()
        .curve(d3.curveCardinal)
        .x(d => x(d.day))
        .y(d => y(d.confirmed));

    var g = svg.selectAll()
        .data(processedData)
        .enter()
        .insert("g", ".focus");
    g.append("path")
        .attr("class", "line cities")
        .style("stroke", d => z(d.country))
        .attr("d", d => line(d.data));


    let tooltipDiv = d3.select("div.tooltip");
    g.selectAll("circle")
        .data( d => d.data)
        .enter()
        .append("circle")
            .attr("cx", d => x(d.day))
            .attr("cy", d => y(d.confirmed))
            .attr("fill", d => z(d.country))
            .attr("r", 3.5)
        .on("mouseover", (d, i, nodes) => {
            d3.select(nodes[i]).transition()
                .attr("r", d => 8);
            tooltipDiv.transition()
                .duration(200)
                .style("opacity", .9);
            tooltipDiv.html(d.country+"<br/>"+
                formatDate(d.date) + "<br/>Confirmed: " + d.confirmed + "<br/>Diff: "+d3.format("+")(d.delta))
                .style("left", (d3.event.pageX - 20) + "px")
                .style("top", (d3.event.pageY + 6) + "px");
        })
        .on("mouseout", (d, i, nodes) => {
            d3.select(nodes[i]).transition()
                .attr("r", d => 3.5);
            tooltipDiv.transition()
                .duration(200)
                .style("opacity", 0);
        });

}


function showCountryList(data) {
    let lst = d3.select("#countryList");
    let countryEnter = lst.selectAll()
        .data(data)
        .enter().insert("li");
    countryEnter
        .append('input')
        .attr('type', 'checkbox')
        .attr('id', d => "input_"+d.country)
        .attr('class', 'countrySel')
        .attr('data-country', d => d.country);
    countryEnter
        .append('label')
        .attr('for',  d => "input_"+d.country)
        .attr('class', "tag")
        .style('background', d => z(d.country))
        .text(d => d.country);
}


function getCountrySummary(data) {
    let result = data
        .map(item => {
            console.log("proc:", item);
            return {
                country: item.country,
                maxConfirmed: item.data[item.data.length-1].confirmed,
                start: item.data[0].date
            }
        }
    ).sort((a,b)=>
        a.maxConfirmed < b.maxConfirmed? -1:
            a.maxConfirmed > b.maxConfirmed? 1:
                0
    );
    result.reverse();
    return result;
}

function aggregateCountries(data) {
    let countryList = new Set(data.map(it => it.country));
    let result = [];
    for (let country of countryList) {
        let m = {};
        for (let row of data.filter(d => d.country === country)) {
            for (let item of row.data) {
                let k = item.date.getTime();
                if (k in m) {
                    m[k] = m[k] + Number(item.confirmed);
                } else {
                    m[k] = Number(item.confirmed);
                }
            }
        }
        let keys = Object.keys(m).sort();
        let days = {};
        let delta = {};
        for( let d = 0; d<keys.length; d++) {
            days[keys[d]] = d;
            delta[keys[d]] = 0;
            if (d > 0) {
                delta[keys[d]] = m[keys[d]]-m[keys[d-1]];
            }
        }
        result.push({
            country: country,
            data: keys.map(k => {
                return {date: new Date(Number(k)), confirmed: m[k], day: days[k], delta: delta[k], country: country}
            }).filter( it => it.confirmed>0)
        });
    }
    return result;
}


function getDataPoint(d) {
    let parseDate = d3.timeParse("%m/%e/%y");
    let result = {};
    result['country'] = d['Country/Region'];
    result['state'] = d['Province/State'];
    let arr = [];
    result['data'] = arr;
    for (let elem of Object.entries(d)) {
        if (elem[0].match(/^[0-9]/)) {
            arr.push({date: parseDate(elem[0]), confirmed: elem[1]});
        }
    }
    arr.sort(it => it['date']);
    return result;
}

function getExtent(arr, fn) {
    let result = undefined;
    for( let item of arr ) {
        let tmp = d3.extent(item, fn);
        if(result) {
            tmp.push(...result);
            result = d3.extent(tmp);
        } else {
            result = tmp;
        }
    }
    return result;
}