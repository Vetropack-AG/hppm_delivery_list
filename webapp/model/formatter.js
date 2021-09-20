sap.ui.define([
	"zvgt/hppm/library"
], function (hppm) {
	"use strict";

	return {

		shipmentStatusState: function (sStatus) {
			switch (sStatus) {
			case hppm.SHIPMENT_STATUS.NEW:
				return "Error";
			case hppm.SHIPMENT_STATUS.PLANNED:
				return "Warning";
			case hppm.SHIPMENT_STATUS.POD:
				return "Success";
			default:
				return "Error";
			}
		},

		inspectionStatusState: function (sStatus) {
			switch (sStatus) {
			case hppm.INSPECTION_STATUS.OPEN:
				return "Error";
			case hppm.INSPECTION_STATUS.LOADED:
				return "Warning";
			case hppm.INSPECTION_STATUS.UNLOADED:
				return "Warning";
			case hppm.INSPECTION_STATUS.QUALITY:
				return "Information";
			case hppm.INSPECTION_STATUS.QUANTITY:
				return "Information";
			case hppm.INSPECTION_STATUS.POSTED:
				return "Success";
			case hppm.INSPECTION_STATUS.COMPLETED:
				return "Success";
			default:
				return "Error";
			}
		},

		itemInspectionStatusIcon: function (sStatus) {
			switch (sStatus) {
			case hppm.INSPECTION_STATUS.OPEN:
				return "sap-icon://away";
			case hppm.INSPECTION_STATUS.LOADED:
				return "sap-icon://circle-task";
			case hppm.INSPECTION_STATUS.UNLOADED:
				return "sap-icon://circle-task2";
			case hppm.INSPECTION_STATUS.QUALITY:
				return "sap-icon://activities";
			case hppm.INSPECTION_STATUS.QUANTITY:
				return "sap-icon://activities";
			case hppm.INSPECTION_STATUS.POSTED:
				return "sap-icon://accept";
			case hppm.INSPECTION_STATUS.COMPLETED:
				return "sap-icon://accept";
			default:
				return "sap-icon://away";
			}
		},

		// Display the button type according to the message with the highest severity
		// The priority of the message types are as follows: Error > Warning > Success > Info
		messageButtonTypeFormatter: function (aMessages) {
			var sHighestSeverityIcon = sap.m.ButtonType.Emphasized;
			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
				case "Error":
					sHighestSeverityIcon = sap.m.ButtonType.Reject; // eslint-disable-line
					break;
				case "Warning":
					sHighestSeverityIcon = sHighestSeverityIcon !== "Reject" ? sap.m.ButtonType.Critical : sHighestSeverityIcon;
					break;
				case "Success":
					sHighestSeverityIcon = sHighestSeverityIcon !== "Reject" && sHighestSeverityIcon !== "Critical" ? sap.m.ButtonType.Accept :
						sHighestSeverityIcon;
					break;
				default:
					sHighestSeverityIcon = !sHighestSeverityIcon ? sap.m.ButtonType.Emphasized : sHighestSeverityIcon;
					break;
				}
			});
			return sHighestSeverityIcon;
		},

		// Set the button icon according to the message with the highest severity
		messageButtonIconFormatter: function (aMessages) {
			var sIcon = "sap-icon://message-information";
			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
				case "Error":
					sIcon = "sap-icon://message-error";
					break;
				case "Warning":
					sIcon = sIcon !== "sap-icon://message-error" ? "sap-icon://message-warning" : sIcon;
					break;
				case "Success":
					sIcon = "sap-icon://message-error" && sIcon !== "sap-icon://message-warning" ? "sap-icon://message-success" : sIcon;
					break;
				default:
					sIcon = !sIcon ? "sap-icon://message-information" : sIcon;
					break;
				}
			});
			return sIcon;
		},

		itemInspectionStatusState: function (sStatus) {
			switch (sStatus) {
			case hppm.INSPECTION_STATUS.OPEN:
				return "Error";
			case hppm.INSPECTION_STATUS.LOADED:
				return "Warning";
			case hppm.INSPECTION_STATUS.UNLOADED:
				return "Warning";
			case hppm.INSPECTION_STATUS.QUALITY:
				return "Warning";
			case hppm.INSPECTION_STATUS.QUANTITY:
				return "Warning";
			case hppm.INSPECTION_STATUS.POSTED:
				return "Success";
			case hppm.INSPECTION_STATUS.COMPLETED:
				return "Success";
			default:
				return "Warning";
			}
		},

		progressState: function (iValue) {
			if (iValue) {
				if (iValue < 50) {
					return "Error";
				} else if (iValue <= 75) {
					return "Warning";
				} else if (iValue === 100) {
					return "Success";
				} else {
					return "Information";
				}
			}
			return "None";
		},

		calculateLayerLineResult: function (iPieces, iPallets, iHeight, sCalculatorMode) {
			var iConstant = this.getView().getModel("ViewSettings").getProperty("/LayerHeight");
			var sMode = this.getView().getModel("ViewSettings").getProperty("/LayersCalculatorMode");
			if (sMode === "PIECES") {
				return iPallets * iPieces;
			}
			if (sMode === "HEIGHT") {
				return parseInt(iHeight / iConstant * iPallets, 10);
			}
			return 0;
		},

		calculatePalletLineResult: function (iPillarPieces, iPillarCount, iAdditionalPieces) {
			return iPillarPieces * iPillarCount + iAdditionalPieces;
		}

	};
});