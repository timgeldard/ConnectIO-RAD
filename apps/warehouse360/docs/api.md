# warehouse360 API Reference

Currently, the `warehouse360` backend primarily serves as a static file server for the React frontend mockup.

## 📍 Base URL
When running locally: `http://localhost:8003`

## 🔌 Interactive Documentation
When the backend is running, you can access the interactive Swagger UI at:
`http://localhost:8003/api/docs`

## 🛣️ Endpoints

### Static Files
- `GET /`: Serves the `index.html` of the compiled frontend.
- `GET /assets/*`: Serves static assets (images, fonts, scripts).

### Future Endpoints
The backend is prepared to support future API integrations for:
- **Inventory Status:** Real-time quantity checks.
- **Order Management:** Tracking inbound and outbound shipment progress.
- **Alerting:** Pushing critical warehouse events to the frontend.
