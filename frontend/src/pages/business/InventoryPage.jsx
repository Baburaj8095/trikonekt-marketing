import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Button,
  Stack,
  MenuItem,
  TextareaAutosize,
  FormHelperText,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

const PRODUCT_CATEGORIES = [
  "Electronics",
  "Clothing",
  "Food & Beverages",
  "Home & Garden",
  "Sports & Outdoors",
  "Books & Media",
  "Beauty & Personal Care",
  "Other",
];

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function AddProductForm({ tabType, onSubmit }) {
  const [formData, setFormData] = useState({
    productName: "",
    category: "",
    price: "",
    quantity: "",
    description: "",
    image: null,
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.productName.trim()) newErrors.productName = "Product name is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.price) newErrors.price = "Price is required";
    if (isNaN(formData.price) || Number(formData.price) <= 0) {
      newErrors.price = "Price must be a valid positive number";
    }
    if (!formData.quantity) newErrors.quantity = "Quantity is required";
    if (isNaN(formData.quantity) || Number(formData.quantity) < 0) {
      newErrors.quantity = "Quantity must be a valid number";
    }
    if (!formData.description.trim()) newErrors.description = "Description is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        ...formData,
        type: tabType,
      });
      // Reset form
      setFormData({
        productName: "",
        category: "",
        price: "",
        quantity: "",
        description: "",
        image: null,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Product Name"
          name="productName"
          value={formData.productName}
          onChange={handleChange}
          error={!!errors.productName}
          helperText={errors.productName}
          placeholder="Enter product name"
          variant="outlined"
        />

        <TextField
          fullWidth
          select
          label="Category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          error={!!errors.category}
          helperText={errors.category}
          variant="outlined"
        >
          {PRODUCT_CATEGORIES.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat}
            </MenuItem>
          ))}
        </TextField>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="Price"
            name="price"
            type="number"
            value={formData.price}
            onChange={handleChange}
            error={!!errors.price}
            helperText={errors.price}
            placeholder="0.00"
            inputProps={{ step: "0.01", min: "0" }}
            variant="outlined"
          />

          <TextField
            fullWidth
            label="Quantity"
            name="quantity"
            type="number"
            value={formData.quantity}
            onChange={handleChange}
            error={!!errors.quantity}
            helperText={errors.quantity}
            placeholder="0"
            inputProps={{ min: "0" }}
            variant="outlined"
          />
        </Stack>

        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Description
          </Typography>
          <TextareaAutosize
            minRows={4}
            placeholder="Enter product description"
            value={formData.description}
            onChange={(e) => {
              handleChange(e);
              e.target.name = "description";
            }}
            name="description"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: errors.description ? "2px solid #d32f2f" : "1px solid #ccc",
              fontFamily: "inherit",
              fontSize: "14px",
            }}
          />
          {errors.description && (
            <FormHelperText error>{errors.description}</FormHelperText>
          )}
        </Box>

        <Box>
          <input
            accept="image/*"
            style={{ display: "none" }}
            id="image-input"
            type="file"
            onChange={handleImageChange}
          />
          <label htmlFor="image-input" style={{ width: "100%" }}>
            <Button
              component="span"
              fullWidth
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              sx={{
                py: 2,
                border: "2px dashed #ccc",
                "&:hover": {
                  borderColor: "#1976d2",
                  bgcolor: "rgba(25, 118, 210, 0.04)",
                },
              }}
            >
              {formData.image ? formData.image.name : "Upload Product Image"}
            </Button>
          </label>
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ py: 1.5, fontWeight: 600 }}
        >
          Add Product ({tabType})
        </Button>
      </Stack>
    </form>
  );
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleProductSubmit = (data) => {
    console.log("Product added:", data);
    setSuccessMessage(`Product added successfully to ${data.type}!`);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const tabTypes = ["Online", "Offline", "Trizone"];

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "#f1f5f9",
        minHeight: "100vh",
      }}
    >
      {/* HEADER */}
      <Box mb={3}>
        <Typography fontSize={24} fontWeight={900}>
          Inventory & Billing
        </Typography>
        <Typography color="text.secondary">
          Manage products across Online, Offline, and Trizone channels
        </Typography>
      </Box>

      {/* SUCCESS MESSAGE */}
      {successMessage && (
        <Card
          sx={{
            mb: 2,
            borderRadius: 2,
            background: "linear-gradient(90deg, #10b981, #34d399)",
            color: "#fff",
          }}
        >
          <CardContent sx={{ py: 1.5 }}>
            <Typography fontWeight={600}>{successMessage}</Typography>
          </CardContent>
        </Card>
      )}

      {/* ADD PRODUCT FORM */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography fontWeight={800} mb={2}>
            Add New Product
          </Typography>

          {/* TABS */}
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="product type tabs"
              sx={{
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "14px",
                },
                "& .MuiTab-root.Mui-selected": {
                  color: "#1976d2",
                },
              }}
            >
              {tabTypes.map((type) => (
                <Tab
                  key={type}
                  label={type}
                  id={`tab-${type}`}
                  aria-controls={`tabpanel-${type}`}
                />
              ))}
            </Tabs>
          </Box>

          {/* TAB CONTENT */}
          {tabTypes.map((type, index) => (
            <TabPanel key={type} value={tabValue} index={index}>
              <AddProductForm
                tabType={type}
                onSubmit={handleProductSubmit}
              />
            </TabPanel>
          ))}
        </CardContent>
      </Card>

      {/* BACK BUTTON */}
      <Button
        variant="outlined"
        onClick={() => navigate("/business/dashboard")}
        sx={{ mt: 3 }}
      >
        Back to Dashboard
      </Button>
    </Box>
  );
}
