import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { toast } from 'sonner';
import { Home, Building, Users, FileText, DollarSign, Calendar, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// API functions
const api = {
  // Properties
  getProperties: () => axios.get(`${API}/properties`),
  createProperty: (data) => axios.post(`${API}/properties`, data),
  updateProperty: (id, data) => axios.put(`${API}/properties/${id}`, data),
  deleteProperty: (id) => axios.delete(`${API}/properties/${id}`),
  
  // Tenants
  getTenants: () => axios.get(`${API}/tenants`),
  createTenant: (data) => axios.post(`${API}/tenants`, data),
  
  // Rentals
  getRentals: () => axios.get(`${API}/rentals`),
  createRental: (data) => axios.post(`${API}/rentals`, data),
  
  // Payments
  getPayments: () => axios.get(`${API}/payments`),
  createPayment: (data) => axios.post(`${API}/payments`, data),
  markPaymentPaid: (id) => axios.put(`${API}/payments/${id}/pay`),
  
  // Documents
  getDocuments: () => axios.get(`${API}/documents`),
  getPropertyDocuments: (propertyId) => axios.get(`${API}/documents/property/${propertyId}`),
  createDocument: (data) => axios.post(`${API}/documents`, data),
  
  // Analytics
  getDashboardAnalytics: () => axios.get(`${API}/analytics/dashboard`),
  getRevenueAnalytics: () => axios.get(`${API}/analytics/revenue`),
};

// Navigation Component
const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: Home, label: 'Pregled' },
    { path: '/properties', icon: Building, label: 'Nekretnine' },
    { path: '/rentals', icon: Calendar, label: 'Najmovi' },
    { path: '/tenants', icon: Users, label: 'Stanari' },
    { path: '/payments', icon: DollarSign, label: 'Plaćanja' },
    { path: '/documents', icon: FileText, label: 'Dokumenti' }
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-gray-900">Upravljanje Nekretninama</h1>
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await api.getDashboardAnalytics();
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Greška pri učitavanju analitike');
    }
  };

  if (!analytics) {
    return <div className="p-8">Učitavanje...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Pregled</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="total-properties-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupno Nekretnina</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_properties}</div>
          </CardContent>
        </Card>

        <Card data-testid="active-rentals-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktivni Najmovi</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.active_rentals}</div>
          </CardContent>
        </Card>

        <Card data-testid="pending-payments-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plaćanja na čekanju</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.pending_payments}</div>
          </CardContent>
        </Card>

        <Card data-testid="monthly-revenue-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesečni prihod</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.monthly_revenue.toLocaleString()} RSD</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Properties Component
const Properties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await api.getProperties();
      setProperties(response.data);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast.error('Greška pri učitavanju nekretnina');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProperty = async (formData) => {
    try {
      await api.createProperty(formData);
      toast.success('Nekretnina je uspešno kreirana');
      fetchProperties();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating property:', error);
      toast.error('Greška pri kreiranju nekretnine');
    }
  };

  const handleUpdateProperty = async (formData) => {
    try {
      await api.updateProperty(editingProperty.id, formData);
      toast.success('Nekretnina je uspešno ažurirana');
      fetchProperties();
      setEditingProperty(null);
    } catch (error) {
      console.error('Error updating property:', error);
      toast.error('Greška pri ažuriranju nekretnine');
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (window.confirm('Da li ste sigurni da želite da obrišete ovu nekretninu?')) {
      try {
        await api.deleteProperty(propertyId);
        toast.success('Nekretnina je uspešno obrisana');
        fetchProperties();
      } catch (error) {
        console.error('Error deleting property:', error);
        toast.error('Greška pri brisanju nekretnine');
      }
    }
  };

  if (loading) {
    return <div className="p-8">Učitavanje nekretnina...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Nekretnine</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="add-property-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj Nekretninu
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <Card key={property.id} data-testid={`property-card-${property.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {property.title}
                <Badge variant={property.status === 'available' ? 'default' : 'secondary'}>
                  {property.status === 'available' ? 'Dostupno' : 'Izdato'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">{property.address}</p>
              <p className="text-sm">
                <span className="font-medium">Tip:</span> {property.property_type}
              </p>
              <p className="text-sm">
                <span className="font-medium">Površina:</span> {property.area}m²
              </p>
              {property.bedrooms && (
                <p className="text-sm">
                  <span className="font-medium">Spavaće sobe:</span> {property.bedrooms}
                </p>
              )}
              <p className="text-lg font-bold text-blue-600">
                {property.monthly_rent.toLocaleString()} RSD/mesec
              </p>
              <div className="flex space-x-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingProperty(property)}
                  data-testid={`edit-property-${property.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDeleteProperty(property.id)}
                  data-testid={`delete-property-${property.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Property Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent aria-describedby="property-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj Novu Nekretninu</DialogTitle>
          </DialogHeader>
          <div id="property-form-description" className="sr-only">
            Forma za kreiranje nove nekretnine sa osnovnim informacijama
          </div>
          <PropertyForm 
            onSubmit={handleCreateProperty}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Property Dialog */}
      <Dialog open={!!editingProperty} onOpenChange={() => setEditingProperty(null)}>
        <DialogContent aria-describedby="edit-property-form-description">
          <DialogHeader>
            <DialogTitle>Uredi Nekretninu</DialogTitle>
          </DialogHeader>
          <div id="edit-property-form-description" className="sr-only">
            Forma za uređivanje postojeće nekretnine
          </div>
          <PropertyForm 
            property={editingProperty}
            onSubmit={handleUpdateProperty}
            onCancel={() => setEditingProperty(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Property Form Component
const PropertyForm = ({ property, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    title: property?.title || '',
    address: property?.address || '',
    property_type: property?.property_type || 'residential',
    area: property?.area || '',
    bedrooms: property?.bedrooms || '',
    bathrooms: property?.bathrooms || '',
    description: property?.description || '',
    monthly_rent: property?.monthly_rent || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      area: parseFloat(formData.area),
      monthly_rent: parseFloat(formData.monthly_rent),
      bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
      bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="property-form">
      <div>
        <Label htmlFor="title">Naziv</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          data-testid="property-title-input"
          required
        />
      </div>

      <div>
        <Label htmlFor="address">Adresa</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          data-testid="property-address-input"
          required
        />
      </div>

      <div>
        <Label htmlFor="property_type">Tip Nekretnine</Label>
        <Select value={formData.property_type} onValueChange={(value) => setFormData({ ...formData, property_type: value })}>
          <SelectTrigger data-testid="property-type-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="residential">Stambena</SelectItem>
            <SelectItem value="commercial">Poslovna</SelectItem>
            <SelectItem value="land">Zemljište</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="area">Površina (m²)</Label>
          <Input
            id="area"
            type="number"
            value={formData.area}
            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            data-testid="property-area-input"
            required
          />
        </div>

        <div>
          <Label htmlFor="monthly_rent">Mesečna Kirija (RSD)</Label>
          <Input
            id="monthly_rent"
            type="number"
            value={formData.monthly_rent}
            onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
            data-testid="property-rent-input"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bedrooms">Spavaće Sobe</Label>
          <Input
            id="bedrooms"
            type="number"
            value={formData.bedrooms}
            onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
            data-testid="property-bedrooms-input"
          />
        </div>

        <div>
          <Label htmlFor="bathrooms">Kupatila</Label>
          <Input
            id="bathrooms"
            type="number"
            value={formData.bathrooms}
            onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
            data-testid="property-bathrooms-input"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Opis</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          data-testid="property-description-input"
        />
      </div>

      <div className="flex space-x-2">
        <Button type="submit" data-testid="submit-property-form">
          {property ? 'Ažuriraj' : 'Kreiraj'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cancel-property-form">
          Otkaži
        </Button>
      </div>
    </form>
  );
};

// Rentals Component
const Rentals = () => {
  const [rentals, setRentals] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rentalsRes, propertiesRes, tenantsRes] = await Promise.all([
        api.getRentals(),
        api.getProperties(),
        api.getTenants()
      ]);
      setRentals(rentalsRes.data);
      setProperties(propertiesRes.data);
      setTenants(tenantsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRental = async (formData) => {
    try {
      await api.createRental(formData);
      toast.success('Najam je uspešno kreiran');
      fetchData();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating rental:', error);
      toast.error('Greška pri kreiranju najma');
    }
  };

  const getPropertyTitle = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.title : 'Nepoznato';
  };

  const getTenantName = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : 'Nepoznato';
  };

  if (loading) {
    return <div className="p-8">Učitavanje najmova...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Najmovi</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="add-rental-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj Najam
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rentals.map((rental) => (
          <Card key={rental.id} data-testid={`rental-card-${rental.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {getPropertyTitle(rental.property_id)}
                <Badge variant={rental.status === 'active' ? 'default' : 'secondary'}>
                  {rental.status === 'active' ? 'Aktivan' : rental.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Stanar:</span> {getTenantName(rental.tenant_id)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Period:</span> {new Date(rental.start_date).toLocaleDateString()} - {new Date(rental.end_date).toLocaleDateString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">Mesečna kirija:</span> {rental.monthly_rent.toLocaleString()} RSD
              </p>
              <p className="text-sm">
                <span className="font-medium">Depozit:</span> {rental.security_deposit.toLocaleString()} RSD
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Rental Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj Novi Najam</DialogTitle>
          </DialogHeader>
          <RentalForm 
            properties={properties.filter(p => p.status === 'available')}
            tenants={tenants}
            onSubmit={handleCreateRental}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Rental Form Component
const RentalForm = ({ properties, tenants, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    property_id: '',
    tenant_id: '',
    start_date: '',
    end_date: '',
    monthly_rent: '',
    security_deposit: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      monthly_rent: parseFloat(formData.monthly_rent),
      security_deposit: parseFloat(formData.security_deposit)
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="rental-form">
      <div>
        <Label htmlFor="property_id">Nekretnina</Label>
        <Select value={formData.property_id} onValueChange={(value) => setFormData({ ...formData, property_id: value })}>
          <SelectTrigger data-testid="rental-property-select">
            <SelectValue placeholder="Izaberite nekretninu" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.title} - {property.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="tenant_id">Stanar</Label>
        <Select value={formData.tenant_id} onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}>
          <SelectTrigger data-testid="rental-tenant-select">
            <SelectValue placeholder="Izaberite stanara" />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name} - {tenant.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Datum početka</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            data-testid="rental-start-date-input"
            required
          />
        </div>

        <div>
          <Label htmlFor="end_date">Datum završetka</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            data-testid="rental-end-date-input"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="monthly_rent">Mesečna Kirija (RSD)</Label>
          <Input
            id="monthly_rent"
            type="number"
            value={formData.monthly_rent}
            onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
            data-testid="rental-rent-input"
            required
          />
        </div>

        <div>
          <Label htmlFor="security_deposit">Depozit (RSD)</Label>
          <Input
            id="security_deposit"
            type="number"
            value={formData.security_deposit}
            onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
            data-testid="rental-deposit-input"
            required
          />
        </div>
      </div>

      <div className="flex space-x-2">
        <Button type="submit" data-testid="submit-rental-form">
          Kreiraj Najam
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cancel-rental-form">
          Otkaži
        </Button>
      </div>
    </form>
  );
};

// Tenants Component
const Tenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await api.getTenants();
      setTenants(response.data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Greška pri učitavanju stanara');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (formData) => {
    try {
      await api.createTenant(formData);
      toast.success('Stanar je uspešno kreiran');
      fetchTenants();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error('Greška pri kreiranju stanara');
    }
  };

  if (loading) {
    return <div className="p-8">Učitavanje stanara...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Stanari</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="add-tenant-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj Stanara
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tenants.map((tenant) => (
          <Card key={tenant.id} data-testid={`tenant-card-${tenant.id}`}>
            <CardHeader>
              <CardTitle>{tenant.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Email:</span> {tenant.email}
              </p>
              <p className="text-sm">
                <span className="font-medium">Telefon:</span> {tenant.phone}
              </p>
              <p className="text-sm">
                <span className="font-medium">Broj ličnog dokumenta:</span> {tenant.id_number}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Tenant Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj Novog Stanara</DialogTitle>
          </DialogHeader>
          <TenantForm 
            onSubmit={handleCreateTenant}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Tenant Form Component
const TenantForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    id_number: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="tenant-form">
      <div>
        <Label htmlFor="name">Ime i Prezime</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          data-testid="tenant-name-input"
          required
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          data-testid="tenant-email-input"
          required
        />
      </div>

      <div>
        <Label htmlFor="phone">Telefon</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          data-testid="tenant-phone-input"
          required
        />
      </div>

      <div>
        <Label htmlFor="id_number">Broj Ličnog Dokumenta</Label>
        <Input
          id="id_number"
          value={formData.id_number}
          onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
          data-testid="tenant-id-input"
          required
        />
      </div>

      <div className="flex space-x-2">
        <Button type="submit" data-testid="submit-tenant-form">
          Kreiraj Stanara
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cancel-tenant-form">
          Otkaži
        </Button>
      </div>
    </form>
  );
};

// Payments Component
const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, rentalsRes] = await Promise.all([
        api.getPayments(),
        api.getRentals()
      ]);
      setPayments(paymentsRes.data);
      setRentals(rentalsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (formData) => {
    try {
      await api.createPayment(formData);
      toast.success('Plaćanje je uspešno kreirano');
      fetchData();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Greška pri kreiranju plaćanja');
    }
  };

  const handleMarkPaid = async (paymentId) => {
    try {
      await api.markPaymentPaid(paymentId);
      toast.success('Plaćanje je označeno kao plaćeno');
      fetchData();
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      toast.error('Greška pri označavanju plaćanja');
    }
  };

  const getRentalInfo = (rentalId) => {
    const rental = rentals.find(r => r.id === rentalId);
    return rental ? `Najam ${rental.id.slice(0, 8)}` : 'Nepoznato';
  };

  if (loading) {
    return <div className="p-8">Učitavanje plaćanja...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Plaćanja</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="add-payment-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj Plaćanje
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {payments.map((payment) => (
          <Card key={payment.id} data-testid={`payment-card-${payment.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {getRentalInfo(payment.rental_id)}
                <Badge 
                  variant={
                    payment.status === 'paid' ? 'default' : 
                    payment.status === 'overdue' ? 'destructive' : 'secondary'
                  }
                >
                  {payment.status === 'paid' ? 'Plaćeno' : 
                   payment.status === 'overdue' ? 'Dospelo' : 'Na čekanju'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-lg font-bold text-blue-600">
                {payment.amount.toLocaleString()} RSD
              </p>
              <p className="text-sm">
                <span className="font-medium">Datum dospeća:</span> {new Date(payment.due_date).toLocaleDateString()}
              </p>
              {payment.payment_date && (
                <p className="text-sm">
                  <span className="font-medium">Datum plaćanja:</span> {new Date(payment.payment_date).toLocaleDateString()}
                </p>
              )}
              {payment.notes && (
                <p className="text-sm">
                  <span className="font-medium">Napomene:</span> {payment.notes}
                </p>
              )}
              {payment.status !== 'paid' && (
                <Button 
                  size="sm" 
                  onClick={() => handleMarkPaid(payment.id)}
                  data-testid={`mark-paid-${payment.id}`}
                  className="mt-2"
                >
                  Označi kao plaćeno
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Payment Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj Novo Plaćanje</DialogTitle>
          </DialogHeader>
          <PaymentForm 
            rentals={rentals}
            onSubmit={handleCreatePayment}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Payment Form Component
const PaymentForm = ({ rentals, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    rental_id: '',
    amount: '',
    due_date: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      amount: parseFloat(formData.amount)
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="payment-form">
      <div>
        <Label htmlFor="rental_id">Najam</Label>
        <Select value={formData.rental_id} onValueChange={(value) => setFormData({ ...formData, rental_id: value })}>
          <SelectTrigger data-testid="payment-rental-select">
            <SelectValue placeholder="Izaberite najam" />
          </SelectTrigger>
          <SelectContent>
            {rentals.map((rental) => (
              <SelectItem key={rental.id} value={rental.id}>
                Najam {rental.id.slice(0, 8)} - {rental.monthly_rent.toLocaleString()} RSD
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">Iznos (RSD)</Label>
          <Input
            id="amount"
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            data-testid="payment-amount-input"
            required
          />
        </div>

        <div>
          <Label htmlFor="due_date">Datum dospeća</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            data-testid="payment-due-date-input"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Napomene</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          data-testid="payment-notes-input"
        />
      </div>

      <div className="flex space-x-2">
        <Button type="submit" data-testid="submit-payment-form">
          Kreiraj Plaćanje
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cancel-payment-form">
          Otkaži
        </Button>
      </div>
    </form>
  );
};

// Documents Component
const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [documentsRes, propertiesRes] = await Promise.all([
        api.getDocuments(),
        api.getProperties()
      ]);
      setDocuments(documentsRes.data);
      setProperties(propertiesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (formData) => {
    try {
      await api.createDocument(formData);
      toast.success('Dokument je uspešno kreiran');
      fetchData();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Greška pri kreiranju dokumenta');
    }
  };

  const getPropertyTitle = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.title : 'Nepoznato';
  };

  if (loading) {
    return <div className="p-8">Učitavanje dokumenata...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dokumenti</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="add-document-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj Dokument
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {documents.map((document) => (
          <Card key={document.id} data-testid={`document-card-${document.id}`}>
            <CardHeader>
              <CardTitle>{document.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Nekretnina:</span> {getPropertyTitle(document.property_id)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Kategorija:</span> {document.category}
              </p>
              <p className="text-sm">
                <span className="font-medium">Otpremio:</span> {document.uploaded_by}
              </p>
              <p className="text-sm">
                <span className="font-medium">Datum:</span> {new Date(document.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Document Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj Novi Dokument</DialogTitle>
          </DialogHeader>
          <DocumentForm 
            properties={properties}
            onSubmit={handleCreateDocument}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Document Form Component
const DocumentForm = ({ properties, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    property_id: '',
    title: '',
    category: '',
    uploaded_by: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="document-form">
      <div>
        <Label htmlFor="property_id">Nekretnina</Label>
        <Select value={formData.property_id} onValueChange={(value) => setFormData({ ...formData, property_id: value })}>
          <SelectTrigger data-testid="document-property-select">
            <SelectValue placeholder="Izaberite nekretninu" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.title} - {property.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="title">Naziv Dokumenta</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          data-testid="document-title-input"
          required
        />
      </div>

      <div>
        <Label htmlFor="category">Kategorija</Label>
        <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
          <SelectTrigger data-testid="document-category-select">
            <SelectValue placeholder="Izaberite kategoriju" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lease_agreement">Ugovor o najmu</SelectItem>
            <SelectItem value="insurance">Osiguranje</SelectItem>
            <SelectItem value="maintenance">Održavanje</SelectItem>
            <SelectItem value="legal">Pravni dokumenti</SelectItem>
            <SelectItem value="other">Ostalo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="uploaded_by">Otpremio</Label>
        <Input
          id="uploaded_by"
          value={formData.uploaded_by}
          onChange={(e) => setFormData({ ...formData, uploaded_by: e.target.value })}
          data-testid="document-uploader-input"
          required
        />
      </div>

      <div className="flex space-x-2">
        <Button type="submit" data-testid="submit-document-form">
          Kreiraj Dokument
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cancel-document-form">
          Otkaži
        </Button>
      </div>
    </form>
  );
};

// Main App Component
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/documents" element={<Documents />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;