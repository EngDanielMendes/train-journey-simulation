<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	let map;
	let marker;
	let socket;
	let activeSpeed = 1;
	let journeyPath = [];
	let isJourneyStarted = false;
	let isJourneyStopped = false; 

	// Initialize Mapbox
	mapboxgl.accessToken =
		'pk.eyJ1IjoiZGFuaWVsbWVuZHM5OSIsImEiOiJjbTFmOGp1c3ExZ293MnFzYnl0aTBncWgzIn0.xwJMAyS7W2f7QiB5I4-bQw';

	onMount(() => {
		// Initialize the map
		map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/mapbox/satellite-streets-v12',
			center: [-8.6203, 41.1895], // Default center (Guifões CP)
			zoom: 16
		});

		map.on('load', () => {
			map.addSource('route', {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'LineString',
						coordinates: journeyPath
					}
				}
			});

			// Layer that displays the train path
			map.addLayer({
				id: 'route',
				type: 'line',
				source: 'route',
				layout: {
					'line-join': 'round',
					'line-cap': 'round'
				},
				paint: {
					'line-color': '#D22B2B',
					'line-width': 4
				}
			});
		});

		marker = new mapboxgl.Marker().setLngLat([-9.1393, 38.7223]).addTo(map);

		// Connect to WebSocket server
		socket = new WebSocket('ws://localhost:8080');

		// Handle location updates
		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				// Check if it's valid location data (contains numbers for lng/lat)
				if (
					typeof data.lat === 'number' &&
					typeof data.lng === 'number' &&
					!isNaN(data.lat) &&
					!isNaN(data.lng)
				) {
					// It's valid coordinate data, update the marker and path
					// Update marker position
					marker.setLngLat([data.lng, data.lat]);
					map.flyTo({ center: [data.lng, data.lat], essential: true });

					// Update the journey path and map layer
					journeyPath.push([data.lng, data.lat]); // Add new coordinates to the journey path
					map.getSource('route').setData({
						type: 'Feature',
						properties: {},
						geometry: {
							type: 'LineString',
							coordinates: journeyPath // Update the coordinates in the GeoJSON source
						}
					});
				} else {
					// Handle non-coordinate JSON-RPC responses (optional)
					console.log('Alert:', data);
				}
			} catch (error) {
				console.error('Failed to parse Websocket message', error);
			}
		};

		window.addEventListener('beforeunload', resetAndCloseSocket);

		onDestroy(() => resetAndCloseSocket());
	});

	function startJourney(event) {
		event.preventDefault(); 
		event.stopPropagation();

		socket.send(
			JSON.stringify({
				jsonrpc: '2.0',
				method: 'startJourney',
				params: { delaySeconds: 1 },
				id: 1
			})
		);
		isJourneyStarted = true;
		isJourneyStopped = false;
	}

	function stopOrContinueJourney(event) {
		event.preventDefault();
		event.stopPropagation();

		if (isJourneyStopped) {
			// Continue the journey
			socket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'continueJourney',
					id: 2
				})
			);
			isJourneyStopped = false;
		} else {
			socket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'stopJourney',
					id: 3
				})
			);
			isJourneyStopped = true;
		}
	}

	function resetJourney(event) {
		event.preventDefault();
		event.stopPropagation();

		socket.send(
			JSON.stringify({
				jsonrpc: '2.0',
				method: 'resetJourney',
				id: 4
			})
		);

		isJourneyStarted = false;
		isJourneyStopped = true;
		console.log({ isJourneyStarted, isJourneyStopped });

		// Move the marker back to the first coordinate and center the map
		if (journeyPath.length > 0) {
			console.log({ journeyPath });
			const firstLocation = journeyPath[0]; // Assuming journeyData is an array of coordinates
			console.log({ firstLocation });
			marker.setLngLat([firstLocation[0], firstLocation[1]]);
			map.flyTo({ center: [firstLocation[0], firstLocation[1]], essential: true });
		}

		journeyPath = [];

		map.getSource('route').setData({
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'LineString',
				coordinates: journeyPath
			}
		});
	}

	function changeSpeed(speed) {
		activeSpeed = speed;
		socket.send(
			JSON.stringify({
				jsonrpc: '2.0',
				method: 'setReplaySpeed',
				params: { speed },
				id: 2
			})
		);
	}

	// Reset map and close WebSocket connection
	function resetAndCloseSocket() {
		if (socket) {
			socket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'stopJourney',
					id: 3
				})
			);

			socket.close();
		}

		resetJourney();
	}
</script>

<div>
	<div class="controls">
		{#if !isJourneyStarted}
			<label>
				<button on:click={(event) => startJourney(event)}>Start</button>
			</label>
		{:else}
			<label>
				<button on:click={(event) => stopOrContinueJourney(event)}>
					{isJourneyStopped ? 'Continue' : 'Stop'}
				</button>
			</label>
			<label>
				<button on:click={(event) => resetJourney(event)}>Reset</button>
			</label>
		{/if}

		{#if isJourneyStarted}
			<label
				>Speed x1<button class:active={activeSpeed === 1} on:click={() => changeSpeed(1)}>X1</button
				></label
			>

			<label
				>Speed x2<button class:active={activeSpeed === 2} on:click={() => changeSpeed(2)}>X2</button
				></label
			>

			<label
				>Speed x5<button class:active={activeSpeed === 5} on:click={() => changeSpeed(5)}>X5</button
				></label
			>
		{/if}
	</div>

	<div id="map"></div>
</div>

<style>
	.controls {
		background-color: #fff;
		padding: 30px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 30px;
	}

	.controls label {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 10px;
	}
	button {
		width: 80px;
		border-radius: 50%;
		aspect-ratio: 1/1;
		border: 1px solid #000;
		background-color: transparent;
		cursor: pointer;
	}

	.controls label button:hover:not(.active) {
		background-color: rgba(13, 99, 22, 0.2);
		color: #fff;
	}

	.active {
		color: #fff;
		background-color: green;
	}

	#map {
		width: 100%;
		height: 800px;
	}
</style>
