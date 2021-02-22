sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"zvgt/hppm/delivery_list/model/formatter"
], function (BaseController, Filter, FilterOperator, formatter) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.Detail", {
		formatter: formatter,

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
			this.getOwnerComponent().getModel().metadataLoaded(true).then(function () {
				this._bindView(sDeliveryKey);
			}.bind(this));
		},

		onDetailItemPress: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var oContext = oItem.getBindingContext();
			this.navTo("ItemDetail", {
				DeliveryKey: oContext.getProperty("DeliveryKey"),
				ItemKey: oContext.getProperty("ItemKey")
			});
		},

		onAddItemPress: function () {
			var oDialog = this.getFragment("AddDetailDialog", this);
			var oContext = this.getView().getModel().createEntry("/DeliveryItemSet", {
				properties: {
					DeliveryKey: this.getView().getBindingContext().getProperty("DeliveryKey")
				}
			});
			oDialog.setBindingContext(oContext);
			oDialog.open();
		},

		onAddItemDialogSavePress: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			oDialog.setBusy(true);
			this.getView().getModel().submitChanges({
				success: function () {
					oDialog.setBusy(false);
					oDialog.close();
					this.getView().getModel().refresh(true);
				}.bind(this),
				error: function () {
					oDialog.setBusy(false);
				}
			});
		},

		onAddItemDialogClosePress: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			var oContext = oDialog.getBindingContext();
			this.getView().getModel().deleteCreatedEntry(oContext);
			oDialog.close();
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
			this.getView().getModel().refresh(true);

			this._bindItemList(sDeliveryKey);
		},

		_bindItemList: function (sDeliveryKey) {
			var oList = this.getView().byId("ItemList");
			var oTemplate = new sap.m.StandardListItem({
				title: "{ItemKey} - {ItemText}",
				description: "{MaterialNumber} - {MaterialText}",
				info: "{InspectionStatusText}",
				infoState: {
					path: "InspectionStatus",
					formatter: formatter.itemInspectionStatusState
				},
				type: "Active"
			});
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: oTemplate,
				filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)]
			});
		}

	});

});