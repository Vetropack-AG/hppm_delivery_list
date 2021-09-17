sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/library",
	"sap/m/PDFViewer"
], function (BaseController, formatter, hppm, PDFViewer) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.Main", {
		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			jQuery.sap.addUrlWhitelist("blob");
			this._oPdfViewer = new PDFViewer();
			this.getView().addDependent(this._oPdfViewer);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onPrintProtocolPress: function () {
			var sDeliveryKey = this._getSelectedDeliveryKey();
			this.printProtocol(sDeliveryKey)
				.then(function (oData) {
					this._openProtocol(oData.Protocol);
					this.showTranslatedMessageToast("message.protocolPrinted", [sDeliveryKey]);
				}.bind(this));
		},

		onCancelDeliveryPress: function () {
			var sDeliveryKey = this._getSelectedDeliveryKey();
			this.cancelDelivery(sDeliveryKey)
				.then(function () {
					this.showTranslatedMessageToast("message.deliveryCanceled", [sDeliveryKey]);
				}.bind(this));
		},

		onItemPress: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var oContext = oItem.getBindingContext();
			var sTarget;
			if (oContext.getProperty("DeliveryType") === hppm.DELIVERY_TYPE.INTERNAL) {
				sTarget = "Detail";
			} else {
				sTarget = oContext.getProperty("ShipmentStatus") === hppm.SHIPMENT_STATUS.NEW ? "Registration" : "Detail";
			}
			this.navTo(sTarget, {
				DeliveryKey: oContext.getModel().getProperty(oContext.getPath() + "/DeliveryKey")
			});
		},

		onNavToCreateDeliveryPress: function () {
			var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
			if (oCrossAppNav) {
				oCrossAppNav.toExternal({ // eslint-disable-line
					target: {
						semanticObject: "delivery_create",
						action: "display"
					}
				});
			}
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_openProtocol: function (sBase64Data) {
			var sSource = this._convertPdf(sBase64Data);
			this._oPdfViewer.setSource(sSource);
			this._oPdfViewer.open();
		},

		_convertPdf: function (sBase64) {
			var decodedPdfContent = atob(sBase64);
			var byteArray = new Uint8Array(decodedPdfContent.length); // eslint-disable-line
			for (var i = 0; i < decodedPdfContent.length; i++) {
				byteArray[i] = decodedPdfContent.charCodeAt(i);
			}
			var blob = new Blob([byteArray.buffer], {
				type: "application/pdf"
			});
			return URL.createObjectURL(blob);
		},

		_getSelectedDeliveryKey: function () {
			var oData = this._getSelectedDelivery();
			return oData ? oData.DeliveryKey : undefined;
		},

		_getSelectedDelivery: function () {
			var oTable = this._getTable();
			var aContexts = oTable.getSelectedContexts();
			if (aContexts[0]) {
				return aContexts[0].getModel().getProperty(aContexts[0].getPath());
			}
			return undefined;
		},

		_getTable: function () {
			return this.getView().byId("SmartTable").getTable();
		}
	});
});