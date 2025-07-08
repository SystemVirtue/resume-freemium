import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}

interface PersonalInfoSectionProps {
  data: PersonalInfo;
  onChange: (field: keyof PersonalInfo | string, value: any) => void;
}

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ data, onChange }) => {
  const handleLocationChange = (field: keyof PersonalInfo['location'], value: string) => {
    onChange('location', { ...data.location, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="john@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={data.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={data.website}
              onChange={(e) => onChange('website', e.target.value)}
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="linkedin">LinkedIn Profile</Label>
          <Input
            id="linkedin"
            value={data.linkedin}
            onChange={(e) => onChange('linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>

        <div className="space-y-4">
          <Label>Location</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                value={data.location.address}
                onChange={(e) => handleLocationChange('address', e.target.value)}
                placeholder="Street Address"
              />
            </div>
            <div>
              <Input
                value={data.location.city}
                onChange={(e) => handleLocationChange('city', e.target.value)}
                placeholder="City"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                value={data.location.state}
                onChange={(e) => handleLocationChange('state', e.target.value)}
                placeholder="State/Province"
              />
            </div>
            <div>
              <Input
                value={data.location.country}
                onChange={(e) => handleLocationChange('country', e.target.value)}
                placeholder="Country"
              />
            </div>
            <div>
              <Input
                value={data.location.postalCode}
                onChange={(e) => handleLocationChange('postalCode', e.target.value)}
                placeholder="ZIP/Postal Code"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};