/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"zvgt/hppm/delivery_list/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});