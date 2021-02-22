/**
 * *  https://github.com/OpenGov/react-leaflet-heatmap-layer/blob/master/README.md
 */
// https://www.tmd.go.th/info/info.php?FileID=68
// เกณฑ์อากาศร้อน
// 1. อากาศร้อน (Hot) อุณหภูมิตั้งแต่ 35.0 – 39.9 องศาเซลเซียส
// 2. อากาศร้อนจัด (Very Hot) อุณหภูมิตั้งแต่ 40.0 องศาเซลเซียสขึ้นไป
// เกณฑ์อากาศหนาว ใช้อุณหภูมิต่ำสุดประจำวันและใช้เฉพาะในฤดูหนาว
// 1. อากาศเย็น (Cool) อุณหภูมิตั้งแต่ 18.0 – 22.9 องศาเซลเซียส
// 2. อากาศค่อนข้างหนาว (Moderately Cold) อุณหภูมิตั้งแต่ 16.0 – 17.9 องศาเซลเซียส
// 3. อากาศหนาว (Cold) อุณหภูมิตั้งแต่ 8.0 – 15.9 องศาเซลเซียส
// 4. อากาศหนาวจัด (Very Cold) อุณหภูมิตั้งแต่ 7.9 องศาเซลเซียสลงไป

import React, { createRef, Component } from 'react';
import PropTypes from 'prop-types';
import {
  uniqueId,
} from 'lodash';

// screen width
import withWidth, { isWidthDown, isWidthUp } from '@material-ui/core/withWidth';
import { compose } from 'recompose';

// material ui
import Grid from '@material-ui/core/Grid';
import { withStyles } from '@material-ui/core/styles';

// map
import L from 'leaflet';
import {
  Map,
  TileLayer,
  GeoJSON,
  LayerGroup,
  LayersControl,
} from 'react-leaflet';

import HeatmapLayer from 'react-leaflet-heatmap-layer';
import { GestureHandling } from 'leaflet-gesture-handling';

// color
import deepOrange from '@material-ui/core/colors/deepOrange';
import { FaSpinner } from 'Fontawesome';

import { styles } from 'Style';

// css
import 'leaflet/dist/leaflet.css';

const initPath = process.env.MIX_APP_PATH;
const { Overlay } = LayersControl;

class WeatherHeatMap extends Component {
  constructor(props) {
    super(props);

    this.map = null;
    this.refMap = createRef();
    this.refBoundaryRegion = createRef();
    L.Map.addInitHook('addHandler', 'gestureHandling', GestureHandling);

    this.state = {
      height: this.setHeightMap(),
      geojsonRiver: [],
      geojsonRegion: [],

      // for heat map
      addressPoints: [],
      radius: 20,

      regionId: props.regionId,
    };

    this.getRegionStyle = this.getRegionStyle.bind(this);
    this.getGeoJson = this.getGeoJson.bind(this);
    this.handleZoom = this.handleZoom.bind(this);
  }

  componentDidMount() {
    const { handleSetMap } = this.props;

    this._mounted = true;

    this.getGeoJson();
    this.getData();
    this.map = this.refMap.current.leafletElement; 
    handleSetMap(this.map);
  }

  componentDidUpdate(prevProps) {
    const { regionId } = this.props;
    if (this.refBoundaryRegion.current !== null) {
    // eslint-disable-next-line no-underscore-dangle
      const obj = this.refBoundaryRegion.current.leafletElement._layers;

      // thailand
      if (regionId === '') {
        const { location, zoom } = this.props;
        this.map.setView(location, zoom);

        return;
      }

      if (regionId !== prevProps.regionId) {
      // get feature
      // eslint-disable-next-line no-restricted-syntax
        for (const key in obj) {
          if ({}.hasOwnProperty.call(obj, key)) {
            const regionCode = obj[key].feature.properties.code;
            if (regionCode.toString() === regionId) {
              this.map.fitBounds(obj[key].getBounds());
            }
          }
        }
      }
    }
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  getData() {
    const { regionId } = this.state;
    let isLoading = true;
    let condition = '';
    if (regionId !== '') {
      condition = `?region_id=${regionId}`;
    }

    // get data from service
    fetch('API_SERVICE')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Something went wrong ...');
      })
      .then(result => {
        const addressPoints = [];
        if (result.data.data !== null) {
          const currentDateTime = new Date();
          const last24hrs = currentDateTime.setDate(currentDateTime.getDate() - 1);

          const filterDatas = result
            .filter(d => {
              const time = new Date(d.datetime.replace(/-/g, '/')).getTime();
              return last24hrs < time;
            });

          filterDatas.map(row => {
            addressPoints.push([lat, long,
              temperature]);
            return [];
          });
          isLoading = false;
        }

        this.setState({
          isLoading,
          addressPoints,
        });
      })
      .catch(error => this.setState({ error, isLoading: true }));
    return true;
  }

  setHeightMap() {
    const { width } = this.props;
    let heightMap = 710;
    if (isWidthDown('xl', width) && isWidthUp('lg', width)) {
      heightMap = 710;
    } else if (isWidthDown('lg', width) && isWidthUp('md', width)) {
      heightMap = 710;
    } else if (isWidthDown('md', width) && isWidthUp('sm', width)) {
      heightMap = 700;
    } else if (isWidthDown('sm', width) && isWidthUp('xs', width)) {
      heightMap = 550;
    }
    return heightMap;
  }

  setZoomMap() {
    const { width } = this.props;
    let zoom = 6;
    if (isWidthDown('sm', width) && isWidthUp('xs', width)) {
      zoom = 5;
    }
    return zoom;
  }

  getRiverStyle = () => ({
    weight: 0.8,
    opacity: 1,
    color: '#007DBF',
  });

  getGeoJson() {
    Promise.all([
      fetch(`river_main.json`),
      fetch(`region_tmd.json`),
    ])
      .then(([res1, res2]) => Promise.all([res1.json(), res2.json()]))
      .then(([river, region]) => {
        this.setState({ geojsonRiver: river, geojsonRegion: region });
      })
      .catch(error => this.setState({ error }));
  }

  getRegionStyle(feature) {
    const { regionId } = this.props;
    if (regionId !== '0') {
      if (feature.properties.code === regionId) {
        return {
          stroke: true,
          color: deepOrange[700],
          weight: 2,
          fillColor: '#FFF',
          fillOpacity: 0,
        };
      }
    }
    return {
      stroke: false,
      fillColor: '#FFF',
      fillOpacity: 0,
    };
  }

  handleZoom = () => {
    const currentZoom = this.map.getZoom();

    if (currentZoom <= 4) {
      // hide layers
      this.map.removeLayer(this.Layer.current);
    } 
  };

  render() {
    const {
      error,
      isLoading,
      height,
      geojsonRiver,
      addressPoints,
      radius,
      geojsonRegion,
      // blur,
      // max,
    } = this.state;

    const {
      location,
      zoom,
    } = this.props;

    // object defining gradient stop points for heatmap
    const gradient = {
      0.1: '#0080FF',
      0.2: '#58D3F7',
      0.4: '#00FFBF',
      0.6: '#40FF00',
      0.8: '#FFBF00',
      '1.0': '#FA5858',
    };

    //  sample color for heat map gradient
    // 0    : blue   (hsl(240, 100%, 50%))
    // 0.25 : cyan   (hsl(180, 100%, 50%))
    // 0.5  : green  (hsl(120, 100%, 50%))
    // 0.75 : yellow (hsl(60, 100%, 50%))
    // 1    : red    (hsl(0, 100%, 50%))

    // 0    red
    // 0.25 yellow
    // 0.5  green
    // 0.75 cyan
    // 1    blue

    // 0: 0 0 255 (or any blue)
    // 0.5: 0 255 0 (or any green)
    // 1: 255 0 0 (or any red)

    // max: max intensity value for heatmap (default: 3.0)
    // radius: radius for heatmap points (default: 30)
    // maxZoom: maximum zoom for heatmap (default: 18)
    // minOpacity: minimum opacity for heatmap (default: 0.01)
    // blur: blur for heatmap points (default: 15)

    if (error) {
      return <div className="text-center">{error.message}</div>;
    }

    return (
      <>
        <Grid item>
          {isLoading === true && (
            <div className="text-center">
              <FaSpinner size={30} />
            </div>
          )}
          <Map
            id="map"
            center={location}
            zoom={zoom}
            ref={this.refMap}
            style={{ height }}
            onZoomEnd={this.handleZoom}
            gestureHandling
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
              id="OpenStreetMap.HOT"
              attribution='&copy; <a href="http://osm.org/copyright">ESRI World Street Map</a> contributors'
            />
            <GeoJSON
              key={uniqueId()}
              data={geojsonRiver}
              style={this.getRiverStyle()}
            />
            <GeoJSON
              key={uniqueId()}
              data={geojsonRegion}
              style={this.getRegionStyle}
              ref={this.refBoundaryRegion}
              onEachFeature={this.onEachRegionFeature}
            />
            <LayersControl position="topright">
              <Overlay name="อุณหภูมิ" checked="true">
                <LayerGroup ref={this.Layer}>
                  <HeatmapLayer
                    fitBoundsOnLoad
                    fitBoundsOnUpdate
                    points={addressPoints}
                    longitudeExtractor={m => m[1]}
                    latitudeExtractor={m => m[0]}
                    gradient={gradient}
                    intensityExtractor={m => parseFloat(m[2])}
                    radius={Number(radius)}
                  />
                </LayerGroup>
              </Overlay>
            </LayersControl>
          </Map>
        </Grid>
      </>
    );
  }
}

WeatherHeatMap.propTypes = {
  handleSetMap: PropTypes.func.isRequired,
  regionId: PropTypes.string.isRequired,
  location: PropTypes.array.isRequired,
  zoom: PropTypes.number.isRequired,
  width: PropTypes.oneOf(['lg', 'md', 'sm', 'xl', 'xs']).isRequired,
};

export default compose(withWidth(), withStyles(styles))(WeatherHeatMap);
