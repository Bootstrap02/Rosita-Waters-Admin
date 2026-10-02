
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { API_BASE_URL, apiRequest } from './api.js';

import './App.css';

const StoreContext = createContext(null);

/* ---------- default content ---------- */

const CATS = {
  sachet: 'Sachet water',
  bottled: 'Bottled water',
  jug: '20L refill bottles',
  dispenser: 'Water dispensers',
};

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='#E8F1FB'/><text x='100' y='105' font-family='sans-serif' font-size='14' fill='#5A6383' text-anchor='middle'>No photo</text></svg>`
  );

const DEFAULT_HEADER = { phone: '', whatsapp: '', tagline: '' };
const DEFAULT_HOME = { heroTitle: '', heroSub: '', heroText: '' };
const DEFAULT_ABOUT = { intro: '', body: '' };
const DEFAULT_FOOTER = {
  address: '', email: '', facebook: '', instagram: '', x: '', tiktok: '',
};

const fmt = (n, currency = '₦') => currency + Number(n).toLocaleString('en-NG');
const DEFAULT_SITE_CONFIG = {
  brand: '',
  company: '',
  address: '',
  phones: [],
  whatsapp: '',
  email: '',
  socials: {},
  showPrices: true,
  currency: '₦',
  images: {},
};

/* ---------- store ---------- */

function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [home, setHome] = useState(DEFAULT_HOME);
  const [about, setAbout] = useState(DEFAULT_ABOUT);
  const [footer, setFooter] = useState(DEFAULT_FOOTER);
  const [siteConfig, setSiteConfig] = useState(DEFAULT_SITE_CONFIG);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState('products');
  const [apiLog, setApiLog] = useState([]);
  const [toast, setToast] = useState('');
  const [admin, setAdmin] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  const log = (method, path, body) => {
    setApiLog((prev) => [{ method, path, body, at: Date.now() }, ...prev].slice(0, 12));
  };

  const refreshData = async () => {
    setDataLoading(true);
    setLoadError('');
    try {
      const [remoteProducts, sections, remoteOrders, remoteSiteConfig] = await Promise.all([
        apiRequest('/api/products'),
        apiRequest('/api/content'),
        apiRequest('/api/orders'),
        apiRequest('/api/tenant/admin-config'),
      ]);
      setProducts(remoteProducts.map((product) => ({
        id: product._id,
        name: product.name,
        cat: product.category,
        size: product.size,
        pack: product.pack,
        price: product.price,
        img: product.images?.[0]?.secure_url || PLACEHOLDER,
        desc: product.description || '',
        images: product.images || [],
      })));
      setHeader({ ...DEFAULT_HEADER, ...(sections.header || {}) });
      setHome({ ...DEFAULT_HOME, ...(sections.home || {}) });
      setAbout({ ...DEFAULT_ABOUT, ...(sections.about || {}) });
      setFooter({ ...DEFAULT_FOOTER, ...(sections.footer || {}) });
      setOrders(remoteOrders);
      setSiteConfig({
        ...DEFAULT_SITE_CONFIG,
        brand: remoteSiteConfig.brand || remoteSiteConfig.tenantName,
        company: remoteSiteConfig.company || remoteSiteConfig.tenantName,
        ...remoteSiteConfig,
      });
      log('GET', '/api/products');
      log('GET', '/api/content');
      log('GET', '/api/orders');
      log('GET', '/api/tenant/admin-config');
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then(setAdmin)
      .catch((error) => {
        if (error.status !== 401) setLoadError(error.message);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (admin) refreshData();
  }, [admin]);

  const saveProduct = async (draft) => {
    const body = new FormData();
    Object.entries({
      name: draft.name,
      category: draft.cat,
      size: draft.size,
      pack: draft.pack,
      price: String(draft.price),
      description: draft.desc || '',
    }).forEach(([key, value]) => body.append(key, value));
    if (draft.imageFile) body.append('images', draft.imageFile);
    const method = draft.id ? 'PUT' : 'POST';
    const path = draft.id ? `/api/products/${draft.id}` : '/api/products';
    const product = await apiRequest(path, { method, body });
    const saved = {
      id: product._id,
      name: product.name,
      cat: product.category,
      size: product.size,
      pack: product.pack,
      price: product.price,
      img: product.images?.[0]?.secure_url || PLACEHOLDER,
      desc: product.description || '',
      images: product.images || [],
    };
    setProducts((previous) => draft.id
      ? previous.map((item) => (item.id === draft.id ? saved : item))
      : [...previous, saved]);
    log(method, path, { ...draft, imageFile: undefined });
    setEditingId(null);
    showToast(draft.id ? 'Product updated' : 'Product added');
  };

  const deleteProduct = async (id) => {
    await apiRequest(`/api/products/${id}`, { method: 'DELETE' });
    setProducts((previous) => previous.filter((product) => product.id !== id));
    log('DELETE', `/api/products/${id}`);
    showToast('Product deleted');
  };

  const updateOrderStatus = async (id, status) => {
    const order = await apiRequest(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setOrders((previous) => previous.map((entry) => (entry._id === id ? order : entry)));
    log('PUT', `/api/orders/${id}`, { status });
    showToast('Order updated');
  };

  const deleteOrder = async (id) => {
    await apiRequest(`/api/orders/${id}`, { method: 'DELETE' });
    setOrders((previous) => previous.filter((order) => order._id !== id));
    log('DELETE', `/api/orders/${id}`);
    showToast('Order deleted');
  };

  const saveContent = async (section, data) => {
    await apiRequest(`/api/content/${section}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const setters = { header: setHeader, home: setHome, about: setAbout, footer: setFooter };
    setters[section](data);
    log('PUT', `/api/content/${section}`, data);
    showToast('Saved');
  };

  const saveSiteConfig = async (data) => {
    const saved = await apiRequest('/api/tenant/admin-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setSiteConfig((previous) => ({ ...previous, ...saved }));
    log('PUT', '/api/tenant/admin-config', data);
    showToast('Website settings saved');
  };

  const uploadSiteImage = async (key, file) => {
    const body = new FormData();
    body.append('images', file);
    const saved = await apiRequest(`/api/tenant/admin-config/images/${key}`, { method: 'POST', body });
    setSiteConfig((previous) => ({ ...previous, ...saved }));
    log('POST', `/api/tenant/admin-config/images/${key}`);
    showToast('Image uploaded');
  };

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    setAdmin(null);
    setEditingId(null);
  };

  const resetDemo = () => {
    setProducts([]);
    setHeader(DEFAULT_HEADER);
    setHome(DEFAULT_HOME);
    setAbout(DEFAULT_ABOUT);
    setFooter(DEFAULT_FOOTER);
    setEditingId(null);
    setApiLog([]);
  };

  const value = {
    products, orders, header, setHeader, home, setHome, about, setAbout, footer, setFooter,
    siteConfig,
    editingId, setEditingId, page, setPage, apiLog, toast, admin, setAdmin,
    authLoading, dataLoading, loadError, setLoadError, refreshData, logout, saveContent,
    saveProduct, deleteProduct, updateOrderStatus, deleteOrder, saveSiteConfig, uploadSiteImage, resetDemo, showToast, log,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/* ---------- product form ---------- */

function ProductForm({ editId, onSave, onCancel }) {
  const { products, siteConfig } = useStore();
  const existing = products.find((p) => p.id === editId);
  const isNew = editId === 'new' || !existing;

  const [form, setForm] = useState(
    isNew
      ? { id: null, name: '', cat: 'sachet', size: '', pack: '', price: '', desc: '', img: PLACEHOLDER }
      : { ...existing, price: String(existing.price) }
  );
  const [uploaded, setUploaded] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, img: reader.result }));
      setUploaded(true);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, imageFile, price: Number(form.price) });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor">
      <h3>{isNew ? 'New product' : 'Edit product'}</h3>
      <form onSubmit={submit}>
        <label>
          Product name
          <input name="name" required value={form.name} onChange={set('name')} />
        </label>
        <div className="two">
          <label>
            Group
            <select name="cat" value={form.cat} onChange={set('cat')}>
              {Object.entries(CATS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Size
            <input name="size" required value={form.size} onChange={set('size')} placeholder="e.g. 75cl" />
          </label>
        </div>
        <div className="two">
          <label>
            Sold as
            <input name="pack" required value={form.pack} onChange={set('pack')} placeholder="e.g. Pack of 12 bottles" />
          </label>
          <label>
            Price ({siteConfig.currency})
            <input name="price" type="number" min="0" required value={form.price} onChange={set('price')} />
          </label>
        </div>
        <label>
          Description
          <textarea name="desc" value={form.desc} onChange={set('desc')} />
        </label>
        <label>
          Photo
          <div
            className="dz"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag');
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <img className="thumb" src={form.img} alt="" />
            <div className="txt">
              <b>{uploaded || form.img !== PLACEHOLDER ? 'Change photo' : 'Click to upload a photo'}</b>
              <span>JPG or PNG, up to ~5MB. Tap or drag a file here.</span>
            </div>
            <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
        </label>
        <div className="actions">
          <button className="btn btn-red" type="submit" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}</button>
          <button className="btn btn-line" type="button" onClick={onCancel}>Cancel</button>
        </div>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
      </form>
    </div>
  );
}

/* ---------- page text forms (header / home / about / footer) ---------- */

function ContentForm({ section }) {
  const store = useStore();
  const content = store[section];
  const [form, setForm] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await store.saveContent(section, form);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = {
    header: (
      <>
        <label>Phone number shown to customers
          <input name="phone" required value={form.phone} onChange={set('phone')} />
        </label>
        <label>WhatsApp number (international format, no + sign)
          <input name="whatsapp" required value={form.whatsapp} onChange={set('whatsapp')} />
        </label>
        <label>Tagline next to the logo
          <input name="tagline" required value={form.tagline} onChange={set('tagline')} />
        </label>
      </>
    ),
    home: (
      <>
        <label>Headline
          <input name="heroTitle" required value={form.heroTitle} onChange={set('heroTitle')} />
        </label>
        <label>Tagline under the headline
          <input name="heroSub" required value={form.heroSub} onChange={set('heroSub')} />
        </label>
        <label>Intro paragraph
          <textarea name="heroText" required value={form.heroText} onChange={set('heroText')} />
        </label>
      </>
    ),
    about: (
      <>
        <label>Intro line
          <textarea name="intro" required value={form.intro} onChange={set('intro')} />
        </label>
        <label>Full story
          <textarea name="body" required value={form.body} onChange={set('body')} />
        </label>
      </>
    ),
    footer: (
      <>
        <label>Business address
          <textarea name="address" required value={form.address} onChange={set('address')} />
        </label>
        <label>Contact email
          <input name="email" type="email" required value={form.email} onChange={set('email')} />
        </label>
        <div className="two">
          <label>Facebook link
            <input name="facebook" value={form.facebook} onChange={set('facebook')} placeholder="https://facebook.com/..." />
          </label>
          <label>Instagram link
            <input name="instagram" value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/..." />
          </label>
        </div>
        <div className="two">
          <label>X (Twitter) link
            <input name="x" value={form.x} onChange={set('x')} />
          </label>
          <label>TikTok link
            <input name="tiktok" value={form.tiktok} onChange={set('tiktok')} />
          </label>
        </div>
      </>
    ),
  };

  const title = section === 'footer' ? 'Footer & contact' : section.charAt(0).toUpperCase() + section.slice(1) + ' page';

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <h2>{title}</h2>
          <p>The text shown on the {section} section of the main site.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        {fields[section]}
        <button className="btn btn-red" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
      </form>
    </div>
  );
}

function TenantSettingsPanel() {
  const store = useStore();
  const [form, setForm] = useState({
    brand: store.siteConfig.brand || '',
    company: store.siteConfig.company || '',
    address: store.siteConfig.address || '',
    phones: (store.siteConfig.phones || []).join(', '),
    whatsapp: store.siteConfig.whatsapp || '',
    email: store.siteConfig.email || '',
    currency: store.siteConfig.currency || '₦',
    showPrices: store.siteConfig.showPrices !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm((previous) => ({
    ...previous,
    [key]: key === 'showPrices' ? event.target.checked : event.target.value,
  }));
  const [uploadingKey, setUploadingKey] = useState('');
  const upload = async (key, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file (JPG, PNG or WEBP).'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('That image is larger than 5MB.'); return; }
    setUploadingKey(key);
    setError('');
    try {
      await store.uploadSiteImage(key, file);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploadingKey('');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await store.saveSiteConfig({
        brand: form.brand,
        company: form.company,
        address: form.address,
        whatsapp: form.whatsapp,
        email: form.email,
        currency: form.currency,
        showPrices: form.showPrices,
        phones: form.phones.split(',').map((phone) => phone.trim()).filter(Boolean),
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <h2>Website settings</h2>
          <p>Public branding and contact defaults for {store.admin?.tenant || 'this client'}.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>Website brand
          <input required maxLength={120} value={form.brand} onChange={set('brand')} />
        </label>
        <label>Company name
          <input maxLength={120} value={form.company} onChange={set('company')} />
        </label>
        <label>Business address
          <textarea maxLength={500} value={form.address} onChange={set('address')} />
        </label>
        <label>Phone numbers (comma-separated)
          <input value={form.phones} onChange={set('phones')} placeholder="+234 800 000 0000" />
        </label>
        <div className="two">
          <label>WhatsApp number
            <input value={form.whatsapp} onChange={set('whatsapp')} />
          </label>
          <label>Public email
            <input type="email" value={form.email} onChange={set('email')} />
          </label>
        </div>
        <div className="two">
          <label>Currency symbol
            <input maxLength={3} value={form.currency} onChange={set('currency')} />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.showPrices} onChange={set('showPrices')} />
            Show product prices publicly
          </label>
        </div>
        <h3 className="sub">Website images</h3>
        <p className="muted">Upload a JPG, PNG or WEBP (max 5MB). Uploads go live immediately.</p>
        {Object.entries({
          logo: 'Logo',
          homeHero: 'Home page hero',
          sachet: 'Sachet category',
          bottled: 'Bottled category',
          jug: '20L refill category',
          dispenser: 'Dispenser category',
          factory: 'Production / factory',
          family: 'About page',
          flyer: 'Flyer',
        }).map(([key, label]) => {
          const current = store.siteConfig.images?.[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img
                src={current || PLACEHOLDER}
                alt=""
                style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, background: '#E8F1FB' }}
              />
              <label style={{ flex: 1, margin: 0 }}>{label}{uploadingKey === key ? ' — uploading…' : ''}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={Boolean(uploadingKey)}
                  onChange={(event) => { upload(key, event.target.files?.[0]); event.target.value = ''; }}
                />
              </label>
            </div>
          );
        })}
        <button className="btn btn-red" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
      </form>
    </div>
  );
}

/* ---------- products panel ---------- */

function ProductsPanel() {
  const store = useStore();

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <h2>Products</h2>
          <p>Everything added or edited here is what shoppers see on the Products page of the main site.</p>
        </div>
        <button className="btn btn-red" onClick={() => store.setEditingId('new')}>
          + Add product
        </button>
      </div>

      {store.products.length ? (
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Size / pack</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {store.products.map((p) => (
                <tr key={p.id}>
                  <td data-label="Photo"><img src={p.img} alt="" /></td>
                  <td data-label="Product">
                    <b>{p.name}</b>
                    <br />
                    <span className="pill">{CATS[p.cat] || p.cat}</span>
                  </td>
                  <td data-label="Size / pack">
                    {p.size}
                    <br />
                    <span className="muted">{p.pack}</span>
                  </td>
                  <td data-label="Price">{fmt(p.price, store.siteConfig.currency)}</td>
                  <td data-label="" className="rowbtns">
                    <button className="btn btn-line btn-sm" onClick={() => store.setEditingId(p.id)}>Edit</button>
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        if (window.confirm('Delete this product? This cannot be undone.')) {
                          store.deleteProduct(p.id).catch((error) => store.showToast(error.message));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No products yet. Add your first one above.</div>
      )}

      {store.editingId && (
        <ProductForm
          key={store.editingId}
          editId={store.editingId}
          onSave={store.saveProduct}
          onCancel={() => store.setEditingId(null)}
        />
      )}
    </div>
  );
}

function OrdersPanel() {
  const store = useStore();
  const [updatingId, setUpdatingId] = useState(null);

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <h2>Orders</h2>
          <p>Customer orders belong to this client and are read from the secure API.</p>
        </div>
      </div>
      {store.orders.length ? (
        <div className="tblwrap">
          <table>
            <thead>
              <tr><th>Reference</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {store.orders.map((order) => (
                <tr key={order._id}>
                  <td data-label="Reference"><b>{order.ref}</b><br /><span className="muted">{new Date(order.createdAt).toLocaleString()}</span></td>
                  <td data-label="Customer">{order.customer.name}<br /><span className="muted">{order.customer.phone}</span></td>
                  <td data-label="Items">{order.items.map((item) => `${item.qty} × ${item.name}`).join(', ')}</td>
                  <td data-label="Total">{fmt(order.total, store.siteConfig.currency)}</td>
                  <td data-label="Status">
                    <select
                      value={order.status}
                      disabled={updatingId === order._id}
                      onChange={async (event) => {
                        setUpdatingId(order._id);
                        try {
                          await store.updateOrderStatus(order._id, event.target.value);
                        } catch (error) {
                          store.showToast(error.message);
                        } finally {
                          setUpdatingId(null);
                        }
                      }}
                    >
                      {['new', 'confirmed', 'fulfilled', 'cancelled'].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Action">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        if (window.confirm(`Delete order ${order.ref}? This cannot be undone.`)) {
                          store.deleteOrder(order._id).catch((error) => store.showToast(error.message));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">No orders yet.</div>}
    </div>
  );
}

/* ---------- API notes panel ---------- */

function ApiPanel() {
  const { apiLog, admin } = useStore();

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <h2>API &amp; setup notes</h2>
          <p>Live API connection for {admin?.tenant || 'this client'} and the admin portal.</p>
        </div>
      </div>
      <div className="notice">
        <b>Connected API:</b> {API_BASE_URL}. Products, images, and page content are saved to the shared backend.
      </div>
      <h3 className="sub">Expected endpoints</h3>
      <div className="tblwrap" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Method &amp; path</th>
            </tr>
          </thead>
          <tbody>
            <tr><td data-label="Action">List products (used by the main site too)</td><td data-label="Method & path"><span className="pill">GET</span> /api/products</td></tr>
            <tr><td data-label="Action">Add a product</td><td data-label="Method & path"><span className="pill">POST</span> /api/products</td></tr>
            <tr><td data-label="Action">Edit a product</td><td data-label="Method & path"><span className="pill">PUT</span> /api/products/:id</td></tr>
            <tr><td data-label="Action">Delete a product</td><td data-label="Method & path"><span className="pill">DELETE</span> /api/products/:id</td></tr>
            <tr><td data-label="Action">Read/update header, home, about, or footer text</td><td data-label="Method & path"><span className="pill">GET/PUT</span> /api/content/:section</td></tr>
            <tr><td data-label="Action">Submit an order from the main site</td><td data-label="Method & path"><span className="pill">POST</span> /api/orders</td></tr>
          </tbody>
        </table>
      </div>
      <h3 className="sub">Live call log (this session)</h3>
      <div className="log">
        {apiLog.length ? (
          apiLog.map((entry) => (
            <div key={entry.at + entry.path} className="logrow">
              <b>{entry.method}</b> {entry.path}
              {entry.body ? '\n' + JSON.stringify(entry.body, null, 2) : ''}
            </div>
          ))
        ) : (
          'No calls yet. Edit a product or a page and save it.'
        )}
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

const NAV = [
  { group: 'Catalogue', items: [{ key: 'products', label: 'Products' }] },
  { group: 'Sales', items: [{ key: 'orders', label: 'Orders' }] },
  {
    group: 'Pages',
    items: [
      { key: 'header', label: 'Header' },
      { key: 'home', label: 'Home page' },
      { key: 'about', label: 'About page' },
      { key: 'footer', label: 'Footer & contact' },
    ],
  },
  { group: 'System', items: [
    { key: 'settings', label: 'Website settings' },
    { key: 'api', label: 'API & setup notes' },
  ] },
];

function AdminShell() {
  const { page, setPage, toast, admin, logout, showToast, loadError, dataLoading, refreshData } = useStore();

  if (dataLoading) {
    return <div className="auth-shell"><div className="auth-card">Connecting to the client API…</div></div>;
  }
  if (loadError) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>API connection failed</h1>
          <p className="auth-error" role="alert">{loadError}</p>
          <button className="btn btn-red" onClick={refreshData}>Try again</button>
          <button className="btn btn-line" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  const content = (() => {
    switch (page) {
      case 'products': return <ProductsPanel />;
      case 'orders': return <OrdersPanel />;
      case 'settings': return <TenantSettingsPanel />;
      case 'api': return <ApiPanel />;
      case 'header':
      case 'home':
      case 'about':
      case 'footer':
        return <ContentForm key={page} section={page} />;
      default: return null;
    }
  })();

  return (
    <>
      <div className="topbar">
        <div className="id">
          <span className="drop">Rar</span>
          <div style={{ minWidth: 0 }}>
            <b>{admin?.tenant || 'Client'} Admin</b>
            <span>Content &amp; product manager</span>
          </div>
        </div>
        <div className="account">
          <span className="badge">{admin?.email}</span>
          <button className="btn btn-line btn-sm" onClick={() => logout().catch((error) => showToast(error.message))}>Sign out</button>
        </div>
      </div>

      <div className="shell">
        <div className="navwrap">
          <nav className="side">
            {NAV.map((g) => (
              <div className="navgroup" key={g.group}>
                <div className="grp">{g.group}</div>
                {g.items.map((it) => (
                  <button
                    key={it.key}
                    className={page === it.key ? 'on' : ''}
                    onClick={() => setPage(it.key)}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <main>{content}</main>
      </div>

      <div className={'toast' + (toast ? ' on' : '')} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function AuthScreen({ setAdmin, error: initialError, setLoadError }) {
  // login -> forgot (email + new password) -> otp (enter emailed code) -> back to login
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);

  const go = (next) => { setMode(next); setError(''); setMessage(''); };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (mode === 'login') {
        const user = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAdmin(user);
        setLoadError('');
      } else if (mode === 'forgot') {
        if (newPassword.length < 12) throw new Error('Your new password must be at least 12 characters.');
        if (newPassword !== confirmPassword) throw new Error('The two passwords do not match.');
        await apiRequest('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setOtp('');
        setMode('otp');
        setMessage('We sent a 6-digit code to your email. Enter it below to finish changing your password.');
      } else {
        // OTP step: verify the code, then apply the new password chosen on the previous screen
        const result = await apiRequest('/api/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email, otp }),
        });
        await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: result.resetToken, password: newPassword }),
        });
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setMode('login');
        setMessage('Password changed. Sign in with your new password.');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const titles = { login: 'Admin sign in', forgot: 'Forgot your password?', otp: 'Enter your code' };
  const descriptions = {
    login: 'Sign in to manage your website.',
    forgot: 'Enter your admin email and the new password you want. We will email you a code to confirm.',
    otp: 'Enter the 6-digit code from your email. It expires in 10 minutes.',
  };

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <span className="drop">Rar</span>
        <h1>{titles[mode]}</h1>
        <p>{descriptions[mode]}</p>

        {mode !== 'otp' ? (
          <label>
            Admin email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        ) : null}

        {mode === 'login' ? (
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        ) : null}

        {mode === 'forgot' ? (
          <>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </>
        ) : null}

        {mode === 'otp' ? (
          <label>
            One-time code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
            />
          </label>
        ) : null}

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        {message ? <p className="auth-success" role="status">{message}</p> : null}

        <button className="btn btn-red" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send code' : 'Confirm and change password'}
        </button>

        {mode === 'login' ? (
          <button className="auth-link" type="button" onClick={() => go('forgot')}>
            Forgot password?
          </button>
        ) : (
          <button className="auth-link" type="button" onClick={() => go(mode === 'otp' ? 'forgot' : 'login')}>
            {mode === 'otp' ? 'Back' : 'Back to sign in'}
          </button>
        )}
      </form>
    </main>
  );
}

function Application() {
  const { admin, setAdmin, authLoading, loadError, setLoadError } = useStore();
  if (authLoading) {
    return <div className="auth-shell"><div className="auth-card">Checking your admin session…</div></div>;
  }
  if (admin) return <AdminShell />;
  return <AuthScreen setAdmin={setAdmin} error={loadError} setLoadError={setLoadError} />;
}

export default function App() {
  return (
    <StoreProvider>
      <Application />
    </StoreProvider>
  );
}
