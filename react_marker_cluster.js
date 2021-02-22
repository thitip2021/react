/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/**
เดิมสี color marker มาจากจำนวน จุด
< 10 สีเขียว
< 100 เหลือง
> 100 ส้ม
ปรับให้สีแสดงตามค่าสูงสุดของอุณหภูมิในกลุ่ม
ขนาดของวงกลมตามจำนวนสถานีในกลุ่ม

CircleMarker render เร็วกว่า icon marker
https://github.com/Leaflet/Leaflet.markercluster
- showCoverageOnHover: When you mouse over a cluster it shows the bounds of its markers.
- zoomToBoundsOnClick: When you click a cluster we zoom to its bounds.
- spiderfyOnMaxZoom: When you click a cluster at the bottom zoom level we spiderfy it so you can see
all of its markers. (Note: the spiderfy occurs at the current zoom level if all items within
the cluster are
still clustered at the maximum zoom level or at zoom specified by disableClusteringAtZoom option)
- removeOutsideVisibleBounds: Clusters and markers too far from the viewport are removed
from the map for performance.

- getChildCount: Returns the total number of markers contained within that cluster.
- getAllChildMarkers: Returns the array of total markers contained within that cluster.
- spiderfy: Spiderfies the child markers of this cluster
- unspiderfy: Unspiderfies a cluster (opposite of spiderfy)
 */

// comment จากผู้ใช้
// - ช่วงแสดงอุณหภูมิต่ำสุด แสดงช่วงระหว่าง 1 พฤศจิกายน -สิ้นเดือนกุมพาพันธ์
// -ช่วงแสดงอุณหภูมิสุงสุด แสดงช่วงระหว่าง 1 มีนาคม -สิ้นเดือนตุลาคม

import React, { createRef, Component } from 'react';
import PropTypes from 'prop-types';
import {
  uniqueId, orderBy,
} from 'lodash';
import moment from 'moment';

// material ui
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { Hidden } from '@material-ui/core';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { withStyles } from '@material-ui/core/styles';

// map
import L from 'leaflet';
import {
  Map, GeoJSON, CircleMarker, Marker, Popup, TileLayer, Tooltip, LayerGroup, LayersControl,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { GestureHandling } from 'leaflet-gesture-handling';

// screen width
import withWidth, { isWidthDown, isWidthUp } from '@material-ui/core/withWidth';
import { compose } from 'recompose';

import deepOrange from '@material-ui/core/colors/deepOrange';
import { FaSpinner, FaChartLine } from 'Fontawesome';
import { styles } from 'Style';

import weatherContext from 'Context';

// color
import TemperatureStatusColor from './TemperatureStatusColor';

import TemperatureChart from 'Chart';

// css
import 'leaflet/dist/leaflet.css';
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css';
import 'react-leaflet-markercluster/dist/styles.min.css';

import './styles.scss';

const initPath = process.env.MIX_APP_PATH;
const { BaseLayer, Overlay } = LayersControl;

const formatValue = value => (typeof value === 'undefined' || value == null ? '-' : parseFloat(value).toFixed(2));

const createClusterCustomIcon = cluster => {
  const markers = cluster.getAllChildMarkers();
  let mean = 0;
  let sum = 0;
  const dataArray = [];
  markers.map(marker => {
    sum += marker.options.value;
    dataArray.push(marker.options.value);
    return sum;
  });
  mean = sum / markers.length;

    const currentMonth = moment().format('M');
  const value = (currentMonth >= 11 || currentMonth <= 2) ? Math.min(...dataArray) : Math.max(...dataArray) ;

  let colorClass = 'marker-cluster-lite-cold';
  if (value > 40) {
    colorClass = 'marker-cluster-extra-hot';
  } else if (value > 35) {
    // orange
    colorClass = 'marker-cluster-hot';
  } else if (value > 18) {
    colorClass = 'marker-cluster-lite-cold';
  } else if (value > 16) {
    colorClass = 'marker-cluster-little-cold';
    // light blue
  } else if (value > 8) {
    // light navy
    colorClass = 'marker-cluster-cold';
  } else if (value <= 8) {
    // navy
    colorClass = 'marker-cluster-extra-cold';
  }

  // cluster size
  let x = 45;
  let y = 45;
  if (cluster.getChildCount() < 10) {
    x = 40;
    y = 40;
  } else if (cluster.getChildCount() > 100) {
    x = 50;
    y = 50;
  }

  return L.divIcon({
    html: `<div><span>${formatValue(value)}℃</span></div>`,
    className: `leaflet-marker-icon marker-cluster ${colorClass} leaflet-zoom-animated leaflet-interactive`,
    iconSize: L.point(x, y, true),
  });
};

class WeatherMapCanvas extends Component {
  constructor(props) {
    super(props);

    this.map = null;
    this.refMap = createRef();
    this.refBoundaryRegion = createRef();
    this.refBoundaryProvince = createRef();
    this.temperatureLayer = createRef();
    L.Map.addInitHook('addHandler', 'gestureHandling', GestureHandling);

    this.state = {
      error: '',
      height: this.setHeightMap(),
      geojsonRegion: [],
      geojsonProvince: [],
      datas: [],

      regionId: props.regionId,
    };

    this.getRegionStyle = this.getRegionStyle.bind(this);
    this.getProvinceStyle = this.getProvinceStyle.bind(this);
    this.getGeoJson = this.getGeoJson.bind(this);
    this.getProvinceGeoJson = this.getProvinceGeoJson.bind(this);
  }

  componentDidMount() {
    const { handleSetMap } = this.props;

    this._mounted = true;

    this.getGeoJson();
    this.getProvinceGeoJson();
    this.getData();
    this.map = this.refMap.current.leafletElement; 
    handleSetMap(this.map);
  }

  componentDidUpdate(prevProps) {
    const { regionId } = this.props;

    // thailand
    if (regionId === '' && prevProps.regionId !== '') {
      const { location, zoom } = this.props;
      this.map.setView(location, zoom);

      return;
    }

    let mainObj = this.refBoundaryRegion.current;
    if (regionId.length > 1) {
      mainObj = this.refBoundaryProvince.current;
    }

    if (mainObj !== null) {
    // eslint-disable-next-line no-underscore-dangle
      const obj = mainObj.leafletElement._layers;

      if (regionId !== prevProps.regionId) {
      // get feature
      // eslint-disable-next-line no-restricted-syntax
        for (const key in obj) {
          if ({}.hasOwnProperty.call(obj, key)) {
            if (regionId.length > 1) {
              const provCode = obj[key].feature.properties.prov_code;
              if (provCode.toString() === regionId) {
                this.map.fitBounds(obj[key].getBounds());
              }
            } else {
              const regionCode = obj[key].feature.properties.code;
              if (regionCode.toString() === regionId) {
                this.map.fitBounds(obj[key].getBounds());
              }
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
      if (regionId.length > 1) {
        condition = `?province_code=${regionId}`;
      } else {
        condition = `?region_code_tmd=${regionId}`;
      }
    }

    // get data from service
    fetch(`API_SERVICE`)
      en(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('get data Something went wrong ...');
      })
      en(result => {
        let datas = [];
        if (result !== null) {
          const currentDateTime = new Date();
          const last24hrs = currentDateTime.setDate(currentDateTime.getDate() - 1);

          datas = result
            .filter(d => {
              const time = new Date(d.datetime.replace(/-/g, '/')).getTime();
              return last24hrs < time;
            });

          isLoading = false;
        }

        this.setState({
          isLoading,
          datas,
        });
      })
      .catch(error => this.setState({ error, isLoading: true }));
    return true;
  }

  getGeoJson() {
    fetch(`${initPath}json/boundary/region_tmd.json`)
      en(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('loading region Something went wrong ...');
      })
      en(result => {
        this.setState({
          geojsonRegion: result,
        });
      })
      .catch(error => this.setState({ error }));
  }

  getProvinceGeoJson() {
    fetch(`thailand.json`)
      en(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('loading region Something went wrong ...');
      })
      en(result => {
        this.setState({
          geojsonProvince: result,
        });
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

  getProvinceStyle(feature) {
    const { regionId } = this.props;
    if (regionId !== '0') {
      if (feature.properties.prov_code === regionId) {
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

  setHeightMap() {
    const { width } = this.props;
    let heightMap = 750;
    if (isWidthDown('xl', width) && isWidthUp('lg', width)) {
      heightMap = 750;
    } else if (isWidthDown('lg', width) && isWidthUp('md', width)) {
      heightMap = 750;
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

  // set marker icon based on criteria
  setIcon = val => {
    const status = TemperatureStatusColor(val);

    return status.icon;
  }

  getRiverStyle = () => ({
    weight: 0.8,
    opacity: 1,
    color: '#007DBF',
  })

  handleChart = (handler, data) => e => {
    e.preventDefault();

    const params = {
      header: 'กราฟอุณหภูมิ',
      content: <TemperatureChart id={id} provinceId={prov_code} />,
    };
    handler(params);
  }

  // add marker reference
  bindMarker = id => ref => {
    const { markers } = this.props;
    if (ref) {
      markers[id] = ref.leafletElement;
      markers[id].addEventListener('click', e => {
        this.map.panTo(e.target.getLatLng());
      });
    }
  }

  eachData = (data, i) => {
    const {
      datas,
    } = this.state;
    const {
      location, zoom, classes,
    } = this.props;

    if (lat && long && temperature != null) {
      // status colors
      const statusColor = TemperatureStatusColor(temperature);

      let locationText = '';
      if (tumbonname !== undefined) {
        locationText = `ต.${tumbon_name} `;
      }
      if (amphoename !== undefined) {
        locationText += `อ.${amphoe_name} `;
      }
      if (provname !== undefined) {
        locationText += `จ.${prov_name}`;
      }

      return (
        <CircleMarker
          id={id}
          key={i}
          center={[Number(lat), Number(long)]}
          ref={this.bindMarker(id)}
          zoom={zoom}
          datas={datas}
          value={temperature}
          classes={classes}
          zIndexOffset={i}
          radius={7}
          fillOpacity={0.5}
          weight={1}
          stroke
          fillColor={statusColor.color.statusColor}
          onMouseOver={e => e.target.setStyle({ weight: 4 })}
          onMouseOut={e => e.target.setStyle({ weight: 1 })}
        >
          <Popup autoPan={false}>
            <div>
              <Table aria-labelledby="Info">
                <TableBody>
                  <TableRow>
                    <TableCell className={classes.hiddenLine} padding="none" colSpan={2} align="center">
                      <Typography variant="subtitle2">
                        {name}
                      </Typography>
                      <Typography variant="subtitle2">
                        {locationText}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className={classes.hiddenLine}>อุณหภูมิ</TableCell>
                    <TableCell className={classes.hiddenLine} align="right">
                      <strong>{ formatValue(temperature) }</strong>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={classes.hiddenLine}>
                      <Typography variant="caption" color="secondary">
                        หน่วย : (องศาเซลเซียส)
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={classes.hiddenLine}>
                      <Typography variant="caption" color="secondary">
                        {datetime}
                        {' '}
                        {'น.          '}
                      </Typography>
                    </TableCell>
                    <TableCell className={classes.hiddenLine} align="right">
                      <weatherContext.Consumer>
                        {({ handleModalOpen }) => (
                          <Button
                            color="secondary"
                            onClick={this.handleChart(handleModalOpen, data)}
                            title="แสดงกราฟ"
                            style={{ padding: 0 }}
                          >
                            <FaChartLine className={classes.rightIcon} />
                          </Button>
                        )}
                      </weatherContext.Consumer>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Popup>
          <Hidden smDown>
            <Tooltip title={`สถานี${name}`}>
              <span>
                <strong>
                  {`สถานี${name}`}
                </strong>
                <br />4
                {`ต.${tumbon_name} อ.${amphoe_name} `}
                {`จ.${provname}`}
                <br />
                {`${agency_name}`}
                <br />
                {`อุณหภูมิ: ${formatValue(temperature)} ℃`}
              </span>
            </Tooltip>
          </Hidden>
        </CircleMarker>
      );
    }
    return false;
  }

  render() {
    const {
      error, height, datas, isLoading, geojsonRegion, geojsonProvince,
    } = this.state;
    const {
      location, zoom,
    } = this.props;

    if (error) {
      return <div className="text-center">{error.message}</div>;
    }

    // preferCanvas = true to render markers on canvas instead of SVG
    const prefercanvas = true;

    return (
      <>
        {isLoading === true && (
        <div className="text-center">
          <FaSpinner size={30} />
        </div>
        )}
        <Map
          id="map"
          center={location}
          zoom={zoom}
          zoomSnap={0}
          zoomDelta={0.5}
          ref={this.refMap}
          style={{ height }}
          gestureHandling
          preferCanvas={prefercanvas}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            id="OpenStreetMap.HOT"
            attribution="&copy; <a href=&quot;http://osm.org/copyright&quot;>ESRI World Street Map</a> contributors"
          />
          <GeoJSON
            key={uniqueId()}
            data={geojsonRegion}
            style={this.getRegionStyle}
            ref={this.refBoundaryRegion}
            onEachFeature={this.onEachRegionFeature}
          />
          <GeoJSON
            key={uniqueId()}
            data={geojsonProvince}
            style={this.getProvinceStyle}
            ref={this.refBoundaryProvince}
            onEachFeature={this.onEachProvinceFeature}
          />
          <LayersControl position="topright">
            <BaseLayer checked name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
              />
            </BaseLayer>
            <BaseLayer name="Esri_WorldStreetMap">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              />
            </BaseLayer>
            <Overlay key="temperature" name="อุณหภูมิ" checked="true">
              <LayerGroup ref={this.temperatureLayer}>
                <MarkerClusterGroup
                  chunkedLoading
                  spiderfyOnMaxZoom={false}
                  disableClusteringAtZoom={10}
                  showCoverageOnHover
                  spiderfyDistanceMultiplier={1}
                  removeOutsideVisibleBounds
                  iconCreateFunction={createClusterCustomIcon}
                >
                  {datas.slice(0).map(this.eachData)}
                  {orderBy(datas, ['temperature'], ['asc']).map(this.eachData)}
                </MarkerClusterGroup>
              </LayerGroup>
            </Overlay>
          </LayersControl>
        </Map>
      </>
    );
  }
}

WeatherMapCanvas.propTypes = {
  classes: PropTypes.object.isRequired,
  handleSetMap: PropTypes.func.isRequired,
  regionId: PropTypes.string.isRequired,
  markers: PropTypes.array.isRequired,
  location: PropTypes.array.isRequired,
  zoom: PropTypes.number.isRequired,
  width: PropTypes.oneOf(['lg', 'md', 'sm', 'xl', 'xs']).isRequired,
};

export default compose(withWidth(), withStyles(styles))(WeatherMapCanvas);
