'use strict';
let rawData = undefined;
let procData = undefined;
let countryData = undefined;
let countrySummary = undefined;

let config = {
    visibleCountries: new Set()
};

d3.csv("../data/time_series_19-covid-Confirmed.csv").then(
    d => {
        rawData = d;
        procData = rawData.map(getDataPoint).filter( d => d.data[d.data.length-1].confirmed!=0);
        countryData = aggregateCountries(procData);
        countrySummary = getCountrySummary(countryData);
        showCountryList(countrySummary);

        setAllCountries(true);

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
    console.log(processedData);
    if(!processedData||processedData.length==0) return;

    // console.log(a);
    // console.log(ex);
    window.procd = processedData;
    let x = d3.scaleTime()
        .rangeRound([margin.left, width - margin.right])
        .domain(getExtent(processedData.map( d => d.data), d => d.date));

    var y = d3.scaleLinear()
        .rangeRound([height - margin.bottom, margin.top])
        .domain(getExtent(processedData.map(d=>d.data), it => it.confirmed));

    var z = d3.scaleOrdinal(d3.schemeCategory10);

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + (height - margin.bottom) + ")")
        .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b")));

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(" + margin.left + ",0)")
        .call(d3.axisLeft(y));

    var line = d3.line()
        .curve(d3.curveCardinal)
        .x(d => x(d.date))
        .y(d => y(d.confirmed));

    var g = svg.selectAll()
        .data(processedData)
        .enter()
        .insert("g", ".focus");
    g.append("path")
        .attr("class", "line cities")
        .style("stroke", d => z(d.country))
        .attr("d", d => line(d.data));

    g.selectAll("circle")
        .data( d => d.data)
        .enter()
        .append("circle")
            .attr("cx", d => x(d.date))
            .attr("cy", d => y(d.confirmed))
            .attr("fill", d => z(d.country))
            .attr("r", 3.5);

    function tooltip(copy) {

        var labels = focus.selectAll(".lineHoverText")
            .data(copy);

        labels.enter().append("text")
            .attr("class", "lineHoverText")
            .style("fill", d => z(d))
            .attr("text-anchor", "start")
            .attr("font-size", 12)
            .attr("dy", (_, i) => 1 + i * 2 + "em")
            .merge(labels);

        var circles = focus.selectAll(".hoverCircle")
            .data(copy);

        circles.enter().append("circle")
            .attr("class", "hoverCircle")
            .style("fill", d => z(d))
            .attr("r", 2.5)
            .merge(circles);

        svg.selectAll(".overlay")
            .on("mouseover", function () {
                focus.style("display", null);
            })
            .on("mouseout", function () {
                focus.style("display", "none");
            })
            .on("mousemove", mousemove);

        function mousemove() {

            var x0 = x.invert(d3.mouse(this)[0]),
                i = bisectDate(data, x0, 1),
                d0 = data[i - 1],
                d1 = data[i],
                d = x0 - d0.date > d1.date - x0 ? d1 : d0;

            focus.select(".lineHover")
                .attr("transform", "translate(" + x(d.date) + "," + height + ")");

            focus.select(".lineHoverDate")
                .attr("transform",
                    "translate(" + x(d.date) + "," + (height + margin.bottom) + ")")
                .text(formatDate(d.date));

            focus.selectAll(".hoverCircle")
                .attr("cy", e => y(d[e]))
                .attr("cx", x(d.date));

            focus.selectAll(".lineHoverText")
                .attr("transform",
                    "translate(" + (x(d.date)) + "," + height / 2.5 + ")")
                .text(e => e + " " + "º" + formatValue(d[e]));

            x(d.date) > (width - width / 4)
                ? focus.selectAll("text.lineHoverText")
                    .attr("text-anchor", "end")
                    .attr("dx", -10)
                : focus.selectAll("text.lineHoverText")
                    .attr("text-anchor", "start")
                    .attr("dx", 10)
        }
    }
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
        .text(d => d.country);
}


function getCountrySummary(data) {
    let result = data
        .map(item => {
            console.log("doing "+item.country);
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
        for( let d = 0; d<keys.length; d++) {
            days[keys[d]] = d;
        }
        result.push({
            country: country,
            data: keys.map(k => {
                return {date: new Date(Number(k)), confirmed: m[k], day: days[k], country: country}
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