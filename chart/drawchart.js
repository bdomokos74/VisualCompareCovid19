'use strict';
let rawData = undefined;
let procData = undefined;
let data = undefined;
let locationList = undefined;

let config = {
    visibleCountries: new Set(),
    logScale: false,
    threshold: 15,
    countryView: false,
    countryToShow: undefined
};

let formatDate = d3.timeFormat("%Y-%m-%d");
let formatTooltipDate = d3.timeFormat("%Y-%m-%d %a");
let z = d3.scaleOrdinal(d3.schemePaired);

d3.csv("chart/time_series_19-covid-Confirmed.csv").then(
    d => {
        rawData = d;
        procData = rawData.map(getDataPoint).filter(d => d.data[d.data.length - 1].confirmed != 0);

        setupMain();
        updateChart();

        d3.select("#logScale").on("change", (d, i, nodes) => {
            config.logScale = nodes[i].checked;
            console.log("logscale:" + config.logScale);
            updateChart();
        });
        d3.select("#selectAllCountries").on("change", (d, i, nodes) => {
            selectAllCountries(nodes[i].checked);
            updateChart();
        });
        d3.select("#mainmenu").on("click", _ => {
            d3.select("#subtitle")
                .text("");
            setupMain();
            updateChart();
        });

        function setupMain() {
            data = aggregateCountries(procData);
            data = filterLow(data, config.threshold);
            locationList = getLocationList(data);
            showLocationList(locationList);
            selectLocations(['Italy', 'Spain', 'Germany', 'Switzerland']);
        }

    }
);

function selectAllCountries(status) {
    config.visibleCountries = new Set();
    d3.selectAll("input.countrySel").each((d, i, nodes) => {
        nodes[i].checked = status;
        if (status) config.visibleCountries.add(d.location);
    });
}

function selectLocations(lst) {
    config.visibleCountries = new Set(lst);
    d3.selectAll("input.countrySel").each((d, i, nodes) => {
        if (config.visibleCountries.has(d.location)) {
            nodes[i].checked = true;
        }
    });
}

function countryClicked(evt, sub) {
    if(sub!==undefined&&sub) return false;
    let country = evt.target.innerText;

    d3.select("#subtitle")
        .text(" > "+country);
    d3.select("#selectAllCountries")
        .attr('checked', true);

    console.log("clicked: ", country);

    config.countryToShow = country;
    config.countryView = true;

    data = filterCountry(country);
    data = filterLow(data, config.threshold);
    locationList = getLocationList(data);
    showLocationList(locationList, true);
    selectAllCountries(true);

    updateChart();
}

// https://github.com/CSSEGISandData/COVID-19
function updateChart() {
    let svg = d3.select("#chart"),
        margin = {top: 15, bottom: 15, left: 85, right: 0},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    svg.selectAll("*").remove();

    let processedData = data.filter(d => config.visibleCountries.has(d.location));
    if (!processedData || processedData.length === 0) return;

    let x = d3.scaleLinear()
        .rangeRound([margin.left, width - margin.right])
        .domain(getExtent(processedData.map(d => d.data), d => d.day));

    let scaleY = d3.scaleLinear();
    if (config.logScale) {
        scaleY = d3.scaleLog();
    }
    var y = scaleY
        .rangeRound([height - margin.bottom, margin.top])
        .domain([config.threshold, getExtent(processedData.map(d => d.data), it => it.confirmed)[1]]);

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + (height - margin.bottom) + ")")
        .call(d3.axisBottom(x));

    svg.append("text")      // text label for the x-axis
        .attr("x", width / 2)
        .attr("y", height + margin.bottom)
        .style("text-anchor", "middle")
        .text("Days since confirmed cases higher than " + config.threshold + " in that country");

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(" + margin.left + ",0)")
        .call(d3.axisLeft(y));

    svg.append("text")      // text label for the y-axis
        .attr("y", 120 - margin.left)
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
        .style("stroke", d => z(d.location))
        .attr("d", d => line(d.data));


    let tooltipDiv = d3.select("div.tooltip");

    g.selectAll("circle")
        .data(d => d.data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.day))
        .attr("cy", d => y(d.confirmed))
        .attr("fill", d => z(d.location))
        .attr("r", 3.5)
        .on("mouseover", (d, i, nodes) => {
            d3.select(nodes[i]).transition()
                .attr("r", d => 8);
            tooltipDiv.transition()
                .duration(200)
                .style("opacity", .9);
            tooltipDiv.html(d.location + "<br/>" +
                formatTooltipDate(d.date) + "<br/>Confirmed: " + d.confirmed + "<br/>Diff: " + d3.format("+")(d.delta))
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY + 10) + "px");
        })
        .on("mouseout", (d, i, nodes) => {
            d3.select(nodes[i]).transition()
                .attr("r", d => 3.5);
            tooltipDiv.transition()
                .duration(200)
                .style("opacity", 0);
        });

}


function showLocationList(locationData, subchart) {
    let sub = "";
    let cls = "poi";
    if(subchart) {
        sub = ", true";
        cls="";
    }
    let lst = d3.select("#locationList");
    lst.selectAll("*").remove();
    let countryEnter = lst.selectAll()
        .data(locationData)
        .enter().insert("li");
    countryEnter
        .append('input')
        .attr('type', 'checkbox')
        .attr('id', d => "input_" + d.location)
        .attr('class', 'countrySel')
        .attr('data-location', d => d.location);
    countryEnter
        .append('label')
        .attr('class', 'tag '+cls)
        .attr('onclick', 'countryClicked(event'+sub+')')
        .style('background', d => z(d.location))
        .text(d => d.location);

    d3.selectAll("input.countrySel").on("change", (d, i, nodes) => {
        console.log(nodes[i].dataset.location + ": " + nodes[i].checked);
        if (nodes[i].checked) {
            config.visibleCountries.add(d.location);
        } else {
            config.visibleCountries.delete(d.location);
        }
        updateChart(data);
    });
}


function getLocationList(data) {
    let result = data
        .map(item => {
                console.log("proc:", item);
                return {
                    location: item.location,
                    maxConfirmed: Number(item.data[item.data.length - 1].confirmed),
                    start: item.data[0].date
                }
            }
        ).sort((a, b) =>
            a.maxConfirmed < b.maxConfirmed ? -1 :
                a.maxConfirmed > b.maxConfirmed ? 1 :
                    0
        );
    result.reverse();
    return result;
}

function filterLow(data, threshold) {
    let result = [];
    for (let item of data) {
        let timeS = item.data;
        let newTs = [];
        let keep = false;
        let idx = 0;
        for (let dataPoint of timeS) {
            if (keep || dataPoint.confirmed > threshold) {
                dataPoint.day = idx;
                idx += 1;
                newTs.push(dataPoint);
                keep = true;
            }
        }
        if (newTs.length > 0) {
            item.data = newTs;
            result.push(item);
        }
    }
    return result;
}

function filterCountry(country) {
    let result =[];
    procData.filter(d => d.country === country).forEach(d => {
        result.push({
            location: d.state,
            data: d.data.slice(),
        });
    });
    result = result.filter(d => d.data !== undefined || d.data.length !== 0);
    result.forEach( d=> {
        d.data.sort((a, b) => a.date < b.date ? -1 :
            a.date > b.date ? 1 :
                0);
        let currDay = 0;
        let prev = undefined;
        d.data.forEach( it=> {
            it.day = currDay;
            it.location= d.location;
            currDay++;
            if (prev !== undefined) {
                it.delta = it.confirmed - prev;
            }
            prev = it.confirmed;
        });
    });
    return result;
}

function aggregateCountries(data) {
    let locationList = new Set(data.map(it => it.country));
    let result = [];
    for (let country of locationList) {
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
        for (let d = 0; d < keys.length; d++) {
            days[keys[d]] = d;
            delta[keys[d]] = 0;
            if (d > 0) {
                delta[keys[d]] = m[keys[d]] - m[keys[d - 1]];
            }
        }
        result.push({
            location: country,
            data: keys.map(k => {
                return {date: new Date(Number(k)), confirmed: m[k], day: days[k], delta: delta[k], location: country}
            }).filter(it => it.confirmed > 0)
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
            arr.push({date: parseDate(elem[0]), confirmed: Number(elem[1])});
        }
    }
    arr.sort(it => it['date']);
    return result;
}

function getExtent(arr, fn) {
    let result = undefined;
    for (let item of arr) {
        let tmp = d3.extent(item, fn);
        if (result) {
            tmp.push(...result);
            result = d3.extent(tmp);
        } else {
            result = tmp;
        }
    }
    return result;
}