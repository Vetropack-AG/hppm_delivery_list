sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.Detail", {

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			this.getOwnerComponent().getRouter().getRoute("Detail").attachPatternMatched(this.onRoutePatternMatched, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onRoutePatternMatched: function (oEvent) {
			var sDeliveryKey = oEvent.getParameter("arguments").DeliveryKey;
			this._bindView(sDeliveryKey);
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_getCurrentDeliveryKey: function () {
			var oContext = this.getView().getBindingContext();
			return oContext.getProperty("DeliveryKey");
		},

		_bindView: function (sDeliveryKey) {
			var oModel = this.getOwnerComponent().getModel();
			var sPath = oModel.createKey("/DeliveryHeadSet", {
				DeliveryKey: sDeliveryKey
			});
			this.getView().bindElement(sPath);
			
			this._bindItemList(sDeliveryKey);
		},
		
		_bindItemList: function(sDeliveryKey) {
			var oList = this.getView().byId("ItemList");
			var oTemplate = new sap.m.StandardListItem({
				title:"{ItemKey} - {ItemText}",
				description:"{MaterialNumber} - {MaterialText}",
				info:"{InspectionStatus}" 
			});
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: oTemplate,
				filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)]
			});
		}

	});

});