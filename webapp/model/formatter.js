sap.ui.define([
	"zvgt/hppm/delivery_list/model/constants"
], function (constants) {
	"use strict";

	return {

		shipmentStatusColorScheme: function (sStatus) {
			switch (sStatus) {
			case constants.SHIPMENT_STATUS.NEW:
				return 2;
			case constants.SHIPMENT_STATUS.PLANNED:
				return 5;
			case constants.SHIPMENT_STATUS.POD:
				return 8;
			default:
				return 2;
			}
		},

		inspectionStatusColorScheme: function (sStatus) {
			switch (sStatus) {
			case constants.INSPECTION_STATUS.OPEN:
				return 2;
			case constants.INSPECTION_STATUS.LOADED:
				return 9;
			case constants.INSPECTION_STATUS.UNLOADED:
				return 5;
			case constants.INSPECTION_STATUS.QUALITY:
				return 6;
			case constants.INSPECTION_STATUS.QUANTITY:
				return 7;
			case constants.INSPECTION_STATUS.POSTED:
				return 8;
			default:
				return 2;
			}
		},

		itemInspectionStatusIcon: function (sStatus) {
			switch (sStatus) {
			case constants.INSPECTION_STATUS.OPEN:
				return "sap-icon://away";
			case constants.INSPECTION_STATUS.LOADED:
				return "sap-icon://circle-task";
			case constants.INSPECTION_STATUS.UNLOADED:
				return "sap-icon://circle-task2";
			case constants.INSPECTION_STATUS.QUALITY:
				return "sap-icon://activities";
			case constants.INSPECTION_STATUS.QUANTITY:
				return "sap-icon://activities";
			case constants.INSPECTION_STATUS.POSTED:
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
			case constants.INSPECTION_STATUS.OPEN:
				return "Error";
			case constants.INSPECTION_STATUS.LOADED:
				return "Warning";
			case constants.INSPECTION_STATUS.UNLOADED:
				return "Warning";
			case constants.INSPECTION_STATUS.QUALITY:
				return "Warning";
			case constants.INSPECTION_STATUS.QUANTITY:
				return "Warning";
			case constants.INSPECTION_STATUS.POSTED:
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
		}

	};
});