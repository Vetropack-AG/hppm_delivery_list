sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/delivery_list/model/constants"
], function (BaseController, Filter, FilterOperator, formatter, constants) {
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
					DeliveryKey: this.getView().getBindingContext().getProperty("DeliveryKey"),
					Quantity: "1"
				}
			});
			oDialog.setBindingContext(oContext);
			oDialog.open();
		},

		onAddItemDialogSavePress: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			oDialog.setBusy(true);
			this.getView().getModel().submitChanges({
				success: function (oData) {
					if (!this.isSubmitError(oData)) {
						oDialog.setBusy(false);
						oDialog.close();
						this.showTranslatedMessageToast("message.itemAdded");
						this.getView().getModel().refresh(true);
					} else {
						this.getView().getModel().resetChanges();
					}
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

		onSapPostingPress: function () {
			this._bindPostItemsDialog();
			this.getFragment("PostItemsDialog", this).open();
		},

		onPostItemsDialogSavePress: function (oEvent) {
			var oDialog = this.getFragment("PostItemsDialog", this);
			oDialog.close();
			var oList = oDialog.getContent()[0];
			oList.getItems()
				.map(this._mapListItemToGoodsMovementItemData, this)
				.forEach(this._handlePostGoodsMovement, this);
		},

		onPostItemsCancelSavePress: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onAddCommentPress: function () {
			this.getFragment("AddCommentDialog", this).open();
		},

		onAddCommentDialogSavePress: function (oEvent) {
			this.getView().getModel().submitChanges();
		},

		onAddCommentDialogClosePress: function (oEvent) {
			oEvent.getSource().getParent().close();
			this.getView().getModel().resetChanges();
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_handlePostGoodsMovement: function (oItem) {
			this.postGoodsMovement(oItem)
				.then(this._showItemsPosted.bind(this));
		},

		_mapListItemToGoodsMovementItemData: function (oListItem) {
			return {
				Quantity: oListItem.getContent()[0].getValue().toString(),
				ItemKey: oListItem.getCustomData()[0].getValue(),
				DeliveryKey: this.getDeliveryProperty("DeliveryKey")
			};
		},

		_bindPostItemsDialog: function () {
			var oList = this.getFragment("PostItemsDialog", this).getContent()[0];
			var sDeliveryKey = this.getDeliveryProperty("DeliveryKey");
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: this._createPostItemsDialogTemplate(),
				filters: [
					new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey),
					new Filter("InspectionStatus", FilterOperator.NE, constants.INSPECTION_STATUS.POSTED)
				]
			});
		},

		_createPostItemsDialogTemplate: function () {
			return new sap.m.InputListItem({
				label: "{ItemKey} - {ItemText} / {MaterialNumber} - {MaterialText}",
				content: new sap.m.StepInput({
					min: 1,
					width: "8rem"
				}),
				customData: new sap.ui.core.CustomData({
					key: "ItemKey",
					value: "{ItemKey}"
				})
			});
		},

		_showItemsPosted: function (oData) {
			this.getView().getModel().refresh(true);
			this.showTranslatedMessageToast("message.itemPosted", [oData.ItemKey]);
		},

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