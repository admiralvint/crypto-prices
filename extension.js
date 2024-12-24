const { St, Clutter, Soup, Gio, GLib } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Mainloop = imports.mainloop;
const GObject = imports.gi.GObject;

// Define the CryptoPricesIndicator class with GObject
const CryptoPricesIndicator = GObject.registerClass(
    class CryptoPricesIndicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'Crypto Prices');

            // Create a container for better styling
            this.container = new St.BoxLayout({
                style_class: 'crypto-prices-label'
            });

            // Create a label to display BTC and ETH prices
            this.label = new St.Label({
                text: 'Loading...',
                y_align: Clutter.ActorAlign.CENTER
            });

            // Add the label to the container
            this.container.add_child(this.label);
            
            // Add the container to the button
            this.add_child(this.container);

            // Initialize HTTP session with custom user agent
            this._httpSession = new Soup.Session();
            this._httpSession.user_agent = 'GNOME Shell Extension';
            
            // Debug log
            log('Crypto Prices: Initialized HTTP session');

            // Start updating prices
            this._retryCount = 0;
            this._maxRetries = 3;
            this._updatePrices();
            this._updateLoop = Mainloop.timeout_add_seconds(60, () => {
                this._updatePrices();
                return true;
            });
        }

        _showError(message) {
            this.label.set_text(message);
            this.container.add_style_class_name('crypto-prices-error');
            log(`Crypto Prices Error: ${message}`);
        }

        _clearError() {
            this.container.remove_style_class_name('crypto-prices-error');
        }

        async _updatePrices() {
            const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';
        
            try {
                log('Crypto Prices: Creating HTTP request');
                const request = Soup.Message.new('GET', url);
        
                if (!request) {
                    throw new Error('Failed to create HTTP message');
                }
        
                log('Crypto Prices: Sending request');
                this._httpSession.queue_message(request, (session, message) => {
                    if (message.status_code !== Soup.Status.OK) {
                        log(`Crypto Prices: HTTP Error: ${message.status_code}`);
                        this._showError('Failed to fetch prices');
                        return;
                    }
        
                    try {
                        log('Crypto Prices: Parsing JSON response');
                        const data = JSON.parse(message.response_body.data);
        
                        if (!data || !data.bitcoin || !data.ethereum) {
                            throw new Error('Invalid response format');
                        }
        
                        const btc = data.bitcoin.usd.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        });
                        const eth = data.ethereum.usd.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        });
        
                        log('Crypto Prices: Successfully updated prices');
                        this._clearError();
                        this.label.set_text(`₿ ${btc} | Ξ ${eth}`);
                        this._retryCount = 0;
                    } catch (e) {
                        log(`Crypto Prices: Parsing error: ${e.message}`);
                        this._showError('Invalid response');
                    }
                });
            } catch (e) {
                log(`Crypto Prices - Detailed Error: ${e.message}`);
                this._retryCount++;
        
                if (this._retryCount <= this._maxRetries) {
                    this._showError('Retrying...');
                    Mainloop.timeout_add_seconds(5, () => {
                        this._updatePrices();
                        return false;
                    });
                } else {
                    this._showError('Failed to fetch prices');
                }
            }
        }
        

        destroy() {
            if (this._updateLoop) {
                Mainloop.source_remove(this._updateLoop);
                this._updateLoop = null;
            }
            super.destroy();
        }
    }
);

var cryptoIndicator = null;

function init() {
    log('Crypto Prices: Extension initialized');
}

function enable() {
    log('Crypto Prices: Enabling extension');
    cryptoIndicator = new CryptoPricesIndicator();
    Main.panel.addToStatusArea('crypto-prices', cryptoIndicator);
    log('Crypto Prices: Extension enabled');
}

function disable() {
    log('Crypto Prices: Disabling extension');
    if (cryptoIndicator) {
        cryptoIndicator.destroy();
        cryptoIndicator = null;
    }
    log('Crypto Prices: Extension disabled');
}