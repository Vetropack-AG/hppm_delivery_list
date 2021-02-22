sap.ui.define([], function () {
	"use strict";

	var oConstants = {};

	oConstants.INSPECTION_STATUS = {
		OPEN: "OPEN",
		LOADED: "LOADED",
		UNLOADED: "UNLOADED",
		QUALITY: "QUALITY",
		QUANTITY: "QUANTITY",
		POSTED: "POSTED"
	};

	oConstants.SHIPMENT_STATUS = {
		NEW: "NEW",
		PLANNED: "PLANNED",
		POD: "POD"
	};

	Object.freeze(oConstants);
	return oConstants;
});