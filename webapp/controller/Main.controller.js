sap.ui.define([
    "zvgt/hppm/delivery/list/controller/BaseController",
    "zvgt/hppm/delivery/list/model/formatter"
], function (BaseController, formatter) {
    "use strict";

    return BaseController.extend("zvgt.hppm.delivery.list.controller.Main", {
        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        onInit: function () {
            this._initializePDFViewer();
            this._openPOD();
            
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
            if (oContext.getProperty("DeliveryType") === zvgt.hppm.DELIVERY_TYPE.INTERNAL) {
                sTarget = "Detail";
            } else if (this._isShipmentStatusForRegistration(oContext.getProperty("ShipmentStatus"))) {
                sTarget = "Registration";
            } else {
                sTarget = "Detail";
            }

            var bQualQuanCheck = oContext.getProperty("QualQuanCheck");
            if (zvgt.hppm.isExternalUser() && !bQualQuanCheck) {
                sTarget = "Detail";
            } else if (zvgt.hppm.isExternalUser()) {
                //Service Providers in some case needs to do Qunt. and Qual. check
                this.getView().getModel("UI").setProperty("/IsInternalUser", bQualQuanCheck);
            }
            
            this.navTo(sTarget, {
                DeliveryKey: oContext.getModel().getProperty(oContext.getPath() + "/DeliveryKey")
            }, sTarget === "Registration");
        },



        onNavToCreateDeliveryPress: function () {
            var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
            if (oCrossAppNav) {
                oCrossAppNav.toExternal({ // eslint-disable-line
                    target: {
                        semanticObject: "OutboundDelivery",
                        action: "create"
                    }
                });
            }
        },

        onLabelScanSubmit: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            oEvent.getSource().setValue("");
            this._getDeliveryItemByCaseNumber(sValue)
                .then(this._navToItemDetail.bind(this))
                .catch(this._handleScanLabelError.bind(this));
        },

        onShipmentFilterChange: function (oEvent) {
            var mParams = oEvent.getParameters().getParameters?.();
            if (mParams) {
                if (mParams?.id.includes("DeliveryKey") && mParams?.value.startsWith("096_")) {
                    oEvent.getSource().setFilterData({
                        DeliveryKey: mParams.value.split("_")[1]
                    }, false);
                }
            }
        },

        /* =========================================================== */
        /* private methods                                             */
        /* =========================================================== */

        _isShipmentStatusForRegistration: function (sStatus) {
            return sStatus === zvgt.hppm.SHIPMENT_STATUS.NEW || sStatus === zvgt.hppm.SHIPMENT_STATUS.PLANNED;
        },

        _getDeliveryItemByCaseNumber: function (sCaseNumber) {
            sap.ui.core.BusyIndicator.show(0);
            return new Promise(function (resolve, reject) {
                var oModel = this.getView().getModel();
                oModel.read("/PalletSet", {
                    filters: [
                        new sap.ui.model.Filter("CaseNumber", "EQ", sCaseNumber),
                        new sap.ui.model.Filter("Original", "EQ", true)
                    ],
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            resolve({
                                DeliveryKey: oData.results[0].DeliveryKey,
                                ItemKey: oData.results[0].ItemKey
                            });
                        } else {
                            reject();
                        }
                    },
                    error: reject
                });
            }.bind(this));
        },

        _handleScanLabelError: function () {
            this.showTranslatedErrorMessage("message.labelScanError");
        },

        _navToItemDetail: function (oDelivery) {
            this.navTo("ItemDetail", oDelivery);
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
        },
        _openPOD: function () {
            var oStartUpParameters = this.getOwnerComponent().getComponentData().startupParameters;
            if (oStartUpParameters){
                if (oStartUpParameters.DeliveryKey && oStartUpParameters.DeliveryKey[0]) {
                    var sDeliveryKey = oStartUpParameters.DeliveryKey[0];
                    this.navTo("Registration", {
                        DeliveryKey: sDeliveryKey 
                    });
                }                     
            }
             

        }
    });
});