'use strict';

const threshold = 15;

let formatDate = d3.timeFormat("%Y-%m-%d");

d3.csv("chart/time_series_covid19_confirmed_global.csv").then(
    d => {
        dataSet.init(d);
        controller.defaultChart();
    }
);

var controller = {
    logScale: false,
    _data: undefined,

    setupHandlers: function () {
        d3.select("#logScale").on("change", (d, i, nodes) => {
            this.logScale = nodes[i].checked;
            chart.updateChart(this._data._data, this.logScale);
        });
        d3.select("#selectAllCountries").on("change", (d, i, nodes) => {
            this._data.setVisibilityForAll(nodes[i].checked);
            chart.update(this._data, this.logScale);
            this.setupHandlers();
        });
        d3.select("#mainmenu").on("click", _ => {
            d3.select("#subtitle")
                .text("");
            this.defaultChart();
        });
        d3.selectAll("input.countrySel").on("change", (d, i, nodes) => {
            console.log(nodes[i].dataset.location + ": " + nodes[i].checked);
            this._data.setVisibilityForLocation(nodes[i].dataset.location, nodes[i].checked);
            chart.updateChart(this._data._data, this.logScale);
            this.setupHandlers();
        });
        d3.selectAll("label.country").on("click", (d, i, nodes) => {
            let target = d3.event.target;
            console.log("clicked: ", nodes[i], d, d3.event.target);
            this.countryClicked(target.innerText, target.dataset.subchart);
        });
    },
    countryClicked: function (country, sub) {
        if (sub !== undefined && sub) return false;

        d3.select("#subtitle")
            .text(" > " + country);
        d3.select("#selectAllCountries")
            .attr('checked', true);

        this._data = dataSet.aggregateStates(country);
        chart.update(this._data);
        this.setupHandlers();
    },
    defaultChart: function () {
        this._data = dataSet.aggregateCountries();
        this._data.setVisibleLocations(['Italy', 'Spain', 'Germany', 'Switzerland']);
        chart.update(this._data);
        this.setupHandlers();
    }
};

var chart = {
    formatTooltipDate: d3.timeFormat("%Y-%m-%d %a"),
    z: d3.scaleOrdinal(d3.schemePaired),

    update: function (data, logScale) {
        this.showLocationList(data._locationList);
        this.updateChart(data._data, logScale);
    },
    updateChart: function (data, logScale) {
        let svg = d3.select("#chart"),
            margin = {top: 15, bottom: 15, left: 85, right: 0},
            width = +svg.attr("width") - margin.left - margin.right,
            height = +svg.attr("height") - margin.top - margin.bottom;

        svg.selectAll("*").remove();

        let processedData = data.filter(d => d.show);
        if (!processedData || processedData.length === 0) return;

        let x = d3.scaleLinear()
            .rangeRound([margin.left, width - margin.right])
            .domain(this.getExtent(processedData.map(d => d.data), d => d.day));

        let scaleY = d3.scaleLinear();
        if (logScale) {
            scaleY = d3.scaleLog();
        }
        var y = scaleY
            .rangeRound([height - margin.bottom, margin.top])
            .domain([threshold, this.getExtent(processedData.map(d => d.data), it => it.confirmed)[1]]);

        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", "translate(0," + (height - margin.bottom) + ")")
            .call(d3.axisBottom(x));

        svg.append("text")      // text label for the x-axis
            .attr("x", width / 2)
            .attr("y", height + margin.bottom)
            .style("text-anchor", "middle")
            .text("Days since confirmed cases higher than " + threshold + " in that country");

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
            .style("stroke", d => this.z(d.location))
            .style("fill", "none")
            .attr("d", d => line(d.data));


        let tooltipDiv = d3.select("div.tooltip");

        g.selectAll("circle")
            .data(d => d.data)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.day))
            .attr("cy", d => y(d.confirmed))
            .attr("fill", d => this.z(d.location))
            .attr("r", 3.5)
            .on("mouseover", (d, i, nodes) => {
                d3.select(nodes[i]).transition()
                    .attr("r", d => 8);
                tooltipDiv.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltipDiv.html(d.location + "<br/>" +
                    this.formatTooltipDate(d.date) + "<br/>Confirmed: " + d.confirmed + "<br/>Diff: " + d3.format("+")(d.delta))
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

    },
    showLocationList: function (locationData, subchart) {
        let cls = "poi";
        if (subchart) {
            cls = "";
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
            .attr('data-location', d => d.location)
            .property('checked', d => d.show);
        countryEnter
            .append('label')
            .attr('class', 'tag country ' + cls)
            .attr('data-location', d => d.location)
            .attr('data-subchart', subchart)
            .style('background', d => this.z(d.location))
            .text(d => d.location);
    },
    getExtent: function (arr, fn) {
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
};

class Data {
    constructor(rawData) {
        this._data = rawData;
        this._locationList = getLocationList(rawData);

        function getLocationList(data, visible) {
            let result = data
                .map(item => {
                        // console.log("proc:", item);
                        return {
                            location: item.location,
                            maxConfirmed: Number(item.data[item.data.length - 1].confirmed),
                            start: item.data[0].date,
                            show: visible == undefined || visible.has(item.location)
                        }
                    }
                ).sort((a, b) =>
                    a.maxConfirmed < b.maxConfirmed ? -1 :
                        a.maxConfirmed > b.maxConfirmed ? 1 :
                            0
                );
            result.reverse();
            console.log("loclist:", result);
            return result;
        }
    };

    setVisibleLocations(locationList) {
        let locationSet = locationList ? new Set(locationList) : undefined;
        let setShow = d => d.show = locationSet !== undefined && locationSet.has(d.location);
        this._locationList.forEach(setShow);
        this._data.forEach(setShow);
    }

    setVisibilityForAll(show) {
        let setShow = d => d.show = show;
        this._locationList.forEach(setShow);
        this._data.forEach(setShow);
    }

    setVisibilityForLocation(location, show) {
        let setShow = d => {
            if(d.location===location) d.show = show;
        };
        this._locationList.forEach(setShow);
        this._data.forEach(setShow);
    }
}

var dataSet = {
    init: function (data) {
        this._rawData = data.map(getDataPoint).filter(d => d.data[d.data.length - 1].confirmed != 0);

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
    },


    filterLow: function (data) {
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
    },

    aggregateStates: function (country) {
        let result = [];
        this._rawData.filter(d => d.country === country).forEach(d => {
            result.push({
                location: d.state,
                data: d.data.slice(),
                show: true
            });
        });
        result = result.filter(d => d.data !== undefined || d.data.length !== 0);
        result.forEach(d => {
            d.data.sort((a, b) => a.date < b.date ? -1 :
                a.date > b.date ? 1 :
                    0);
            let currDay = 0;
            let prev = undefined;
            d.data.forEach(it => {
                it.day = currDay;
                it.location = d.location;
                currDay++;
                if (prev !== undefined) {
                    it.delta = it.confirmed - prev;
                }
                prev = it.confirmed;
            });
        });
        let filtered = this.filterLow(result);
        return new Data(filtered);
    },

    aggregateCountries: function () {
        let locationList = new Set(this._rawData.map(it => it.country));
        let result = [];
        for (let country of locationList) {
            let m = {};
            for (let row of this._rawData.filter(d => d.country === country)) {
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
                show: true,
                data: keys.map(k => {
                    return {
                        date: new Date(Number(k)),
                        confirmed: m[k],
                        day: days[k],
                        delta: delta[k],
                        location: country
                    }
                }).filter(it => it.confirmed > 0)
            });
        }
        let filtered = this.filterLow(result);
        return new Data(filtered);
    }
};