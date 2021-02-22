import React, { Component } from 'react'
import PropTypes from 'prop-types'

// screen width
import { withStyles } from '@material-ui/core/styles'
import withWidth, { isWidthDown, isWidthUp } from '@material-ui/core/withWidth'
import { compose } from 'recompose'

import { styles } from 'Style'

import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import highchartsMap from 'highcharts/modules/map'
import proj4 from 'proj4'
import mapDataTH from '@highcharts/map-collection/countries/th/th-all.geo.json'
import markerClusters from 'highcharts/modules/marker-clusters'

import { FaSpinner } from 'Fontawesome'

markerClusters(Highcharts)

// NOTE: when dealing with server side rendering as we are, check for window before doing things with it.
// If you're not doing server side rendering, then you don't need this check and can just assign straight to window.
if (typeof window !== 'undefined') {
  window.proj4 = window.proj4 || proj4
  highchartsMap(Highcharts)
}

class WeatherMapChart extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isLoading: false,
      error: null,
      chartOptions: this.getChartOptions(),
      provinceId: props.provinceId,
      regionId: props.regionId,
    }
  }

  componentDidMount() {
    this.setState({ isLoading: true })

    this.renderChart()
  }

  componentDidUpdate(prevProps) {
    const { regionId } = this.props

    console.log(regionId, prevProps.regionId)
    if (regionId !== prevProps.regionId) {
      this.renderChart()
    }
  }

  // https://api.highcharts.com/highcharts/plotOptions.vector.cluster.layoutAlgorithm.gridSize
  // grid,kmeans,optimizedKmeans   grid เร็วสุด
  getChartOptions() {
    this.options = {
      chart: {
        map: 'countries/th/th-all',
        zoomType: 'xy',
        height: '100%',
      },
      credits: {
        enabled: false,
      },
      mapNavigation: {
        enabled: true,
      },
      tooltip: {
        formatter: function () {
          if (this.point.clusteredData) {
            return 'Clustered points: ' + this.point.clusterPointsAmount
          }
          console.log(this.point)
          return (
            '<b>' +
            this.point.name +
            '</b><br>Lat: ' +
            this.point.lat.toFixed(2) +
            ', Lon: ' +
            this.point.lon.toFixed(2)
          )
        },
      },
      plotOptions: {
        mappoint: {
          cluster: {
            enabled: true,
            layoutAlgorithm: {
              type: 'grid',
              gridSize: 80,
            },
            zones: [
              {
                from: 0,
                to: 10,
                marker: {
                  fillColor: '#99D18E',
                  radius: 10,
                },
              },
              {
                from: 11,
                to: 100,
                marker: {
                  fillColor: '#5AAC44',
                  radius: 15,
                },
              },
              {
                from: 101,
                to: 3000,
                marker: {
                  fillColor: '#49852E',
                  radius: 21,
                },
              },
            ],
          },
        },
      },
      series: [
        {
          // Use the gb-all map with no data as a basemap
          name: 'Basemap',
          mapData: mapDataTH,
          borderColor: '#A0A0A0',
          nullColor: 'rgba(200, 200, 200, 0.3)',
          showInLegend: false,
        },
        {
          type: 'mappoint',
          enableMouseTracking: true,
          colorKey: 'clusterPointsAmount',
          name: 'อุณหภูมิ',
          color: '#4169E1',
          cursor: 'pointer',
          turboThreshold: 3000,
        },
      ],
    }

    return this.options
  }

  renderChart = () => {
    const { regionId } = this.state
    let condition = ''

    if (regionId !== '') {
      if (regionId.length > 1) {
        condition = `?provid=${regionId}`
      } else {
        condition = `?regionid=${regionId}`
      }
    }

    fetch(`API_SERVICE`)
      .then((response) => {
        if (response.ok) {
          return response.json()
        }
        return 'Something went wrong.'
      })
      .then((result) => {
        const chartOptions = this.getChartOptions()
        const dataSeries = []

        result.map((data) => {
          dataSeries.push({
            temperature: temperature,
            lat: lat,
            lon: long,
            name: name,
          })

          return dataSeries
        })
        chartOptions.series[1].data = dataSeries

        this.setState({
          chartOptions,
          isLoading: false,
        })
      })
      .catch((error) => this.setState({ error, isLoading: false }))
  }

  render() {
    const { isLoading, error, chartOptions } = this.state

    if (error) {
      return <div className="text-center">{error.message}</div>
    }

    // if still loading, show spinner
    if (isLoading) {
      return (
        <div className="text-center">
          <FaSpinner size={30} />
        </div>
      )
    }

    return (
      <div>
        <HighchartsReact
          highcharts={Highcharts}
          constructorType={'mapChart'}
          options={chartOptions}
        />
      </div>
    )
  }
}

WeatherMapChart.propTypes = {
  regionId: PropTypes.string.isRequired,
  width: PropTypes.oneOf(['lg', 'md', 'sm', 'xl', 'xs']).isRequired,
}

export default compose(withWidth(), withStyles(styles))(WeatherMapChart)
