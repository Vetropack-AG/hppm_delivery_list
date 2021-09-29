sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, formatter, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.Registration", {
		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			this.getOwnerComponent().getRouter().getRoute("Registration").attachPatternMatched(this.onRoutePatternMatched, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onRoutePatternMatched: function (oEvent) {
			var sDeliveryKey = oEvent.getParameter("arguments").DeliveryKey;
			this.getOwnerComponent().getModel().metadataLoaded(true).then(function () {
				this._bindView(sDeliveryKey);
				this.bindUploadCollection(sDeliveryKey);
			}.bind(this));
		},

		onSavePress: function () {
			var oForm = this.getView().byId("RegistrationForm");
			if (!this.validateForm(oForm, "Registration")) {
				return;
			}
			this._setStatusRegistered();

			var oModel = this.getView().getModel();
			if (oModel.hasPendingChanges()) {
				sap.ui.core.BusyIndicator.show(0);
				oModel.submitChanges({
					success: function (oData) {
						if (!this.isSubmitError(oData)) {
							this._navToDetails();
						}
					}.bind(this)
				});
			} else {
				this._navToDetails();
			}
		},

		onCancelPress: function () {
			var oModel = this.getView().getModel();
			oModel.resetChanges();
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_bindItemList: function (sDeliveryKey) {
			var oList = this.getView().byId("MaterialList");
			var oTemplate = new sap.m.StandardListItem({
				title: "{MaterialNumber} - {MaterialText}"
			});
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: oTemplate,
				filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)]
			});
		},

		_setStatusRegistered: function () {
			this.setDeliveryProperty("ShipmentStatus", "POD");
		},

		_bindView: function (sDeliveryKey) {
			var oModel = this.getOwnerComponent().getModel();
			var sPath = oModel.createKey("/DeliveryHeadSet", {
				DeliveryKey: sDeliveryKey
			});
			this.getView().bindElement(sPath);
			this._bindItemList(sDeliveryKey);
		},

		_navToDetails: function () {
			sap.ui.core.BusyIndicator.hide();
			this.navTo("Detail", {
				DeliveryKey: this.getDeliveryProperty("DeliveryKey")
			});
		}

	});

});