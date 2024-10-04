renderImageMap(): void {
    this.imageMapAttr = this.data.find(({ dataKey }) => {
      return dataKey.name === "imageMap";
    });


    if (!this.imageMapAttr) return;


    const imageData = this.imageMapAttr.data[0][1];
    const markerImage = this.ctx.settings.markerImage;


    if (!imageData.startsWith('<svg') || markerImage) {
      this.imageUrl = this.imageMapAttr.data[0][1];


      return;
    }


    $(this.svgImageMapRef.nativeElement).append(imageData);
  }


clearMapLayers(): void {
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polygon) {
        this.map.removeLayer(layer);
      }
    });
  }




initMap(): void {
    if (this.map) {
      this.map.remove();
    }


    const customCRS = L.extend({}, L.CRS.Simple, {
      transformation: new L.Transformation(1, 0, 1, 0)
    });


    this.map = L.map('svg-image-map', {
      center: [0, 0],
      minZoom: -2,
      maxZoom: 3,
      crs: customCRS,
      zoomControl: false,
      zoomSnap: 0,
      zoomAnimation: true,
      fadeAnimation: true,
    });


    const bounds = [[0, 0], [this.boundsX, this.boundsY]];


    const imageUrl = this.ctx.settings.markerImage;
    const svgElement = this.svgImageMapRef.nativeElement.querySelector('svg');


    if (!imageUrl && !svgElement && !this.imageUrl) {
      console.error("No image found");
      return;
    }


    if (imageUrl) {
      L.imageOverlay(imageUrl, bounds).addTo(this.map);
    }


    if (!imageUrl && !svgElement) {
      L.imageOverlay(this.imageUrl, bounds).addTo(this.map);
    }


    if (!imageUrl && !this.imageUrl) {
      L.svgOverlay(svgElement, bounds).addTo(this.map);
    }


    this.map.fitBounds(bounds);


    const zoomControl = new L.Control.Zoom({
      position: 'bottomright'
    });
    this.map.addControl(zoomControl);


    this.addPolygon();
    this.addMarkers();


    if (this.map) {
      this.resizeObserver = new ResizeObserver(() => {
        this.map.invalidateSize();
      });


      this.resizeObserver.observe(this.svgImageMapRef.nativeElement);
    }


    this.map.on('zoomend', () => {
      const zoomLevel = this.map.getZoom();
      this.updateMarkerSizes(zoomLevel, this.iconSize);
    });
  }


  addPolygon(): void {
    const polygonKey = this.data.filter(el => el.dataKey.name === 'polygon');


    const polygonColor = this.ctx.settings.polygonColor;
    const lineColor = this.ctx.settings.lineColor;


    polygonKey.forEach(key => {
      let rawPolygonCoordinates = JSON.parse(key.data[0][1]);


      if (rawPolygonCoordinates.length === 2) {
        rawPolygonCoordinates = this.extandCoordinates(rawPolygonCoordinates);
      }


      const polygonCoordinates = rawPolygonCoordinates.map(coord => [
        coord[1] * this.boundsX,
        coord[0] * this.boundsY
      ]);


      const initialStyle = {
        color: 'transparent',
        fillColor: 'transparent',
        fillOpacity: 0
      };


      const hoverStyle = {
        color: lineColor,
        fillColor: polygonColor,
        fillOpacity: 1
      };


      const polygon = L.polygon(polygonCoordinates, initialStyle);


      polygon.addTo(this.map);


      const polygonElement = polygon.getElement();
      if (polygonElement) {
        polygonElement.style.transition = 'fill-opacity 0.5s ease, stroke 0.5s ease';
      }


      polygon.on('click', (event) => {
        this.handleClick(ECustomAction.POLYGON, {
          event,
          widgetContext: this.ctx,
          entityId: key.datasource.entityId,
          entityName: key.datasource.entityName,
          entityLabel: key.datasource.entityLabel,
          additionalParams: {}
        });
      });


      polygon.on('mouseover', () => {
        polygon.setStyle(hoverStyle);
      });


      polygon.on('mouseout', () => {
        polygon.setStyle(initialStyle);
      });
    });
  }


  extandCoordinates(rawPolygonCoordinates) {
    return [
      rawPolygonCoordinates[0],
      [rawPolygonCoordinates[1][0],
      rawPolygonCoordinates[0][1]],
      rawPolygonCoordinates[1],
      [
        rawPolygonCoordinates[0][0],
        rawPolygonCoordinates[1][1]
      ],
    ];
  }


  getAllMarkers(): void {
    this.datasources.forEach(datasource => {
      const markerData = datasource.dataKeys.filter(dataKey => {
        return (dataKey.settings.markerImageTrue || dataKey.settings.markerImageFalse) && dataKey.settings.renderIcon
      })


      if (!markerData.length) return;


      this.mapKeyIcons = markerData.map(dataKey => {


        return {
          iconUrl: dataKey.settings.markerImageTrue || dataKey.settings.markerImageFalse,
          iconLabel: dataKey.label,
          iconDescription: dataKey.settings.description
        }
      });
    })
  }


  addMarkers(): void {
    if (!this.datasources) {
      console.error("No marker data found in context.");
      return;
    }


    this.datasources.forEach(datasource => {
      let hiddenIcons = [];


      const roomData = this.data.filter(el => {


        if ((el.data[0][1] !== 'true' && el.data[0][1] !== 'false') && (el.dataKey.name !== 'xPos' && el.dataKey.name !== 'yPos')) {
          hiddenIcons.push(el);
          return;
        };


        return el.datasource.name === datasource.name;
      });


      if (!roomData) return;


      const xPosData = roomData.find(el => el.dataKey.name === 'xPos');
      const yPosData = roomData.find(el => el.dataKey.name === 'yPos');


      if (xPosData === null || xPosData === undefined || yPosData === null || yPosData === undefined) return;


      const markerData = datasource.dataKeys.filter(dataKey => dataKey.settings.markerImageTrue || dataKey.settings.markerImageFalse);


      const { scaleFactor } = this.ctx.settings;
      this.iconSize = [5 * scaleFactor, 5 * scaleFactor]


      markerData.forEach(marker => {
        const markerInformation = roomData.find(data => data.dataKey._hash === marker._hash);


        if (!markerInformation) return;


        const isIconHidden = hiddenIcons.find(icon => icon.dataKey._hash === marker._hash);


        if (isIconHidden) return;


        const { markerImageTrue, markerImageFalse, 'x-offset': xOffset = 0, 'y-offset': yOffset = 0 } = marker.settings;
        const iconUrl = markerInformation.data[0][1] === 'true' ? markerImageTrue : markerImageFalse;


        const x = (xPosData.data[0][1] * this.boundsY) + +xOffset;
        const y = (yPosData.data[0][1] * this.boundsX) - +yOffset;


        const customIcon = L.icon({
          iconUrl,
          iconSize: this.iconSize
        });


        const leafletMarker = L.marker([y, x], { icon: customIcon }).addTo(this.map);


        const zoomLevel = this.map.getZoom();
        this.updateMarkerSizes(zoomLevel, this.iconSize);


        leafletMarker.on('click', (event) => {
          this.handleClick(ECustomAction.ICON, {
            event,
            widgetContext: this.ctx,
            entityId: datasource.entityId,
            entityName: datasource.entityName,
            entityLabel: datasource.entityLabel,
            additionalParams: {


            }
          });
        });
      });
    });
  }


  handleClick(funcName: string, options: any = {}): void {
    const customAction = this.ctx.actionsApi.actionDescriptorsBySourceId[funcName];


    if (!customAction) return;


    const customFunctionString = customAction[0].customFunction;


    if (!customFunctionString) return;


    const customFunction = new Function(
      'event',
      'widgetContext',
      'entityId',
      'entityName',
      'entityLabel',
      'additionalParams',
      customFunctionString
    );


    customFunction(
      options.event,
      options.widgetContext,
      options.entityId,
      options.entityName,
      options.entityLabel,
      options.additionalParams,
    );
  }


  updateMarkerSizes(zoomLevel: number, baseIconSize: number[]): void {
    const scaleFactor = this.getScaleFactor(zoomLevel);


    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        const icon = layer.getIcon() as L.Icon;
        const size = baseIconSize[0] * scaleFactor;
        icon.options.iconSize = [size, size];
        icon.options.iconAnchor = [size / 2, size / 2];
        layer.setIcon(icon);
      }
    });
  }


  getScaleFactor(zoomLevel: number): number {
    switch (zoomLevel) {
      case 0: return 1.5;
      case 1: return 3;
      case 2: return 4.5;
      case 3: return 8;
      default: return 1;
    }
  }


  addInteractivity(): void {
    if (!this.widgetOnDashboard()) return;


    this.renderImageMap();
    this.renderMiniMap();
  }

