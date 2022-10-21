sap.ui.define([

], function () {
	"use strict";

	return {

		calculateAllFields: function (oEvent) {
			var that = this.getView().getController().quantityCalculator; // eslint-disable-line
			that = that ? that : this; // eslint-disable-line
			// calculate by tolerances
			that.calculateRepairQuantity(oEvent);
			that.calculateScrapQuantity(oEvent);

			// calulate other fields
			that.calculateClaimQuantity(oEvent);
			that.calculateOkQuantity(oEvent);
			that.calculateRepairQuantityAboveTolerance(oEvent);
			that.calculateScrapQuantityAboveTolerance(oEvent);
			that.calculateTotalClaimQuantity(oEvent);
			that.calculatePcsToBeChecked(oEvent);
			that.calculateQtyPosted(oEvent);
		},

		calculateQtyPosted: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();

			// dont calculate if the item is already posted
			var sStatus = oContext.getModel().getProperty(oContext.getPath() + "/InspectionStatus");
			if (sStatus === "POSTED") {
				return;
			}
            
            // New logic: WashedQuantity + NeedScrapQuantity - ScrapQuantity --> mail from Janis on 20.10.2022
			var sWashedQuantity = oContext.getProperty("WashedQuantity") || 0;
			var sNeedScrapQuantity = oContext.getProperty("NeedScrapQuantity") || 0;
            var sScrapQuantity = oContext.getProperty("ScrapQuantity") || 0;
			var iQtyPosted = parseInt(sWashedQuantity, 10) + parseInt(sNeedScrapQuantity, 10) - parseInt(sScrapQuantity, 10);
			if (!isNaN(iQtyPosted)) {
				oContext.getModel().setProperty(oContext.getPath() + "/QtyPosted", iQtyPosted > 0 ? iQtyPosted.toString() : "0");
			}
		},

		calculatePcsToBeChecked: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sActualQuantity = oContext.getProperty("ActualQuantity") || 0;
			var sWashedQuantity = oContext.getProperty("WashedQuantity") || 0;
			var sNeedRepairQuantity = oContext.getProperty("NeedRepairQuantity") || 0;
			var sNeedScrapQuantity = oContext.getProperty("NeedScrapQuantity");
			var iPcsToBeChecked = parseInt(sActualQuantity, 10) - (parseInt(sWashedQuantity, 10) + parseInt(sNeedRepairQuantity,
				10) + parseInt(sNeedScrapQuantity, 10));
			var sPcsToBeChecked = iPcsToBeChecked > 0 ? iPcsToBeChecked.toString() : "0";
			oContext.getModel().setProperty(oContext.getPath() + "/PcsToBeChecked", sPcsToBeChecked);
		},

		calculateScrapQuantityAboveTolerance: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sNeedScrapQuantity = oContext.getProperty("NeedScrapQuantity") || 0;
			var sScrapQuantity = oContext.getProperty("ScrapQuantity") || 0;
			var iScrapQuantityAboveTolerance = parseInt(sNeedScrapQuantity, 10) - parseInt(sScrapQuantity, 10);
			if (!isNaN(iScrapQuantityAboveTolerance)) {
				oContext.getModel().setProperty(oContext.getPath() + "/ScrapQuantityAboveTolerance", iScrapQuantityAboveTolerance > 0 ?
					iScrapQuantityAboveTolerance.toString() : "0");
			}
		},

		calculateScrapQuantity: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sScrapTolerance = oContext.getProperty("ScrapTolerance") || 0;
			var sActualQuantity = oContext.getProperty("ActualQuantity") || 0;
			if (parseFloat(sScrapTolerance, 10) > 0) {
				var iScrapQuantity = parseInt(sActualQuantity, 10) * ((parseFloat(sScrapTolerance, 10)) / 100);
				oContext.getModel().setProperty(oContext.getPath() + "/ScrapQuantity", Math.round(iScrapQuantity).toString());
			}
		},

		calculateTotalClaimQuantity: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sRepairQuantityAboveTolerance = oContext.getProperty("RepairQuantityAboveTolerance") || 0;
			var sScrapQuantityAboveTolerance = oContext.getProperty("ScrapQuantityAboveTolerance") || 0;
			var iTotalClaimQuantity = parseInt(sRepairQuantityAboveTolerance, 10) + parseInt(sScrapQuantityAboveTolerance, 10);
			oContext.getModel().setProperty(oContext.getPath() + "/TotalClaimQuantity", iTotalClaimQuantity.toString());
		},

		calculateRepairQuantityAboveTolerance: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sNeedRepairQuantity = oContext.getProperty("NeedRepairQuantity") || 0;
			var sRepairQuantity = oContext.getProperty("RepairQuantity") || 0;
			var iRepairQuantityAboveTolerance = parseInt(sNeedRepairQuantity, 10) - parseInt(sRepairQuantity, 10);
			var sRepairQuantityAboveTolerance = iRepairQuantityAboveTolerance > 0 ? iRepairQuantityAboveTolerance.toString() : "0";
			oContext.getModel().setProperty(oContext.getPath() + "/RepairQuantityAboveTolerance", sRepairQuantityAboveTolerance);
		},

		calculateRepairQuantity: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sRepairTolerance = oContext.getProperty("RepairTolerance") || 0;
			var sActualQuantity = oContext.getProperty("ActualQuantity") || 0;
			if (parseFloat(sRepairTolerance, 10) > 0) {
				var iRepairQuantity = parseInt(sActualQuantity, 10) * (parseFloat(sRepairTolerance, 10) / 100);
				oContext.getModel().setProperty(oContext.getPath() + "/RepairQuantity", Math.round(iRepairQuantity).toString());
			}
		},

		calculateClaimQuantity: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sDeliveryQuantity = oContext.getProperty("Quantity") || 0;
			var sActualQuantity = oContext.getProperty("ActualQuantity") || 0;
			var iClaimQuantity = parseInt(sDeliveryQuantity, 10) - parseInt(sActualQuantity, 10);
			var sClaimQuantity = iClaimQuantity > 0 ? iClaimQuantity.toString() : "0";
			oContext.getModel().setProperty(oContext.getPath() + "/ClaimQuantity", sClaimQuantity);
		},

		calculateOkQuantity: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var sNeedRepairQuantity = oContext.getProperty("NeedRepairQuantity") || 0;
			var sActualQuantity = oContext.getProperty("ActualQuantity") || 0;
			var sNeedScrapQuantity = oContext.getProperty("NeedScrapQuantity") || 0;
			var iOkQuantity = parseInt(sActualQuantity, 10) - parseInt(sNeedRepairQuantity, 10) - parseInt(sNeedScrapQuantity, 10);
			var sOkQuantity = iOkQuantity > 0 ? iOkQuantity.toString() : "0";
			oContext.getModel().setProperty(oContext.getPath() + "/OkQuantity", sOkQuantity);
		}

	};
});